import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { polyfill, h3ToGeoBoundary } from 'npm:h3-js@3.7.2';
import { sendExpoPush } from '../_shared/expo-push.ts';

const H3_RESOLUTION = 11;
const MAX_CELLS = 50_000;
const MAPBOX_MATCH_MAX_COORDS = 100; // Mapbox Map Matching API per-request limit

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SubmitSchema = z.object({
  type: z.enum(['run', 'walk', 'cycle', 'hike']),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  trace: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
  }),
  samples: z.object({
    timestamps: z.array(z.number()),
    accuracy_m: z.array(z.number()),
  }),
  client_calories: z.number().int().positive().optional(),
  // Phase 7 metadata — all optional for back-compat with older clients.
  title:         z.string().min(1).max(80).optional(),
  description:   z.string().max(2000).optional(),
  visibility:    z.enum(['public', 'followers', 'private']).optional(),
  hide_pace:     z.boolean().optional(),
  hide_calories: z.boolean().optional(),
  // Storage paths the client already uploaded under <user_id>/draft/<local_id>/<i>.<ext>.
  // The Edge Function moves them into <user_id>/<activity_id>/<i>.<ext> after the row is created.
  photo_paths:   z.array(z.string().min(1)).max(5).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Mirrors apps/mobile/lib/distance.ts haversineMeters
function haversineMeters(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function traceDistanceM(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    total += haversineMeters(lng1, lat1, lng2, lat2);
  }
  return total;
}

function lineStringWkt(coords: [number, number][]): string {
  return `LINESTRING(${coords.map(([lng, lat]) => `${lng} ${lat}`).join(', ')})`;
}

// Convert h3-js string index (hex) to decimal bigint string for Postgres bigint[]
function h3ToBigIntStr(h3Index: string): string {
  return BigInt('0x' + h3Index).toString();
}

// Build a WKT POLYGON from a cellToBoundary result (h3-js returns [lat, lng][])
function boundaryToWkt(boundary: [number, number][]): string {
  const ring = [...boundary, boundary[0]]
    .map(([lat, lng]) => `${lng} ${lat}`)
    .join(', ');
  return `POLYGON((${ring}))`;
}

// Evenly-spaced subset; Mapbox Matching caps at 100 coords per request.
function downsampleCoords(coords: [number, number][], maxPoints: number): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const out: [number, number][] = [];
  for (let i = 0; i < maxPoints; i++) out.push(coords[Math.round(i * step)]);
  return out;
}

type LineStringGeoJson = { type: 'LineString'; coordinates: [number, number][] };

// Snap raw GPS to the OSM road graph via Mapbox Matching API.
// Returns null on any failure — caller treats matching as best-effort.
async function matchToRoads(coords: [number, number][]): Promise<LineStringGeoJson | null> {
  const token = Deno.env.get('MAPBOX_TOKEN');
  if (!token) {
    console.log('[match] MAPBOX_TOKEN not set in Edge Function environment');
    return null;
  }
  const sampled = downsampleCoords(coords, MAPBOX_MATCH_MAX_COORDS);
  if (sampled.length < 2) {
    console.log('[match] sampled <2 points, skipping');
    return null;
  }
  const path = sampled.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
  const radiuses = sampled.map(() => 50).join(';'); // 50m radius — generous for sparse OSM
  const url =
    `https://api.mapbox.com/matching/v5/mapbox/walking/${path}` +
    `?geometries=geojson&overview=full&radiuses=${radiuses}&tidy=true&access_token=${token}`;
  try {
    const res = await fetch(url);
    const bodyText = await res.text();
    if (!res.ok) {
      console.log(`[match] HTTP ${res.status}: ${bodyText.slice(0, 400)}`);
      return null;
    }
    const data = JSON.parse(bodyText);
    if (data.code !== 'Ok') {
      console.log(`[match] mapbox code=${data.code} msg=${data.message ?? ''}`);
      return null;
    }
    const geom = data.matchings?.[0]?.geometry;
    if (!geom) {
      console.log('[match] response had no matched geometry');
      return null;
    }
    console.log(`[match] success: input=${coords.length} sampled=${sampled.length} matched=${geom.coordinates?.length}`);
    return geom;
  } catch (e) {
    console.log('[match] fetch threw:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ── Push fan-out ────────────────────────────────────────────────────────────────

type DisplacedEntry = { owner_id: string; count: number };

async function fanOutNotifications(
  // deno-lint-ignore no-explicit-any
  admin: any,
  opts: {
    activityId:   string;
    actorUserId:  string;
    cellsCaptured: number;
    displaced:    DisplacedEntry[];
  },
): Promise<void> {
  const { activityId, actorUserId, cellsCaptured, displaced } = opts;

  // Resolve actor display fields (one lookup)
  const { data: actorProfile } = await admin
    .from('profiles')
    .select('username, display_name')
    .eq('id', actorUserId)
    .single();
  const actorUsername    = actorProfile?.username    ?? 'Someone';
  const actorDisplayName = actorProfile?.display_name ?? actorUsername;

  const messages: Parameters<typeof sendExpoPush>[0] = [];
  const queuedTokens = new Set<string>();

  // 1. Steal notifications — one push per displaced owner
  for (const d of displaced) {
    if (!d.count) continue;
    const { data: tokenRows } = await admin
      .from('push_tokens')
      .select('token')
      .eq('user_id', d.owner_id);
    for (const row of tokenRows ?? []) {
      if (queuedTokens.has(row.token)) continue;
      queuedTokens.add(row.token);
      messages.push({
        to:        row.token,
        title:     `${actorUsername} stole your zones`,
        body:      `You lost ${d.count} hex${d.count === 1 ? '' : 'es'}. Take them back.`,
        data:      { type: 'zone_stolen', activity_id: activityId, owner_id: actorUserId },
        channelId: 'steals',
        priority:  'high',
        sound:     'default',
      });
    }
  }

  // 2. Friend-capture notifications — notify followers (skip if too few cells)
  if (cellsCaptured >= 3) {
    const { data: followerRows } = await admin.rpc('followers_for_owner', {
      p_owner_id: actorUserId,
    });
    const followerIds: string[] = (followerRows ?? []).map((r: { follower_id: string }) => r.follower_id);
    if (followerIds.length > 0) {
      const { data: tokenRows } = await admin
        .from('push_tokens')
        .select('token, user_id')
        .in('user_id', followerIds);
      for (const row of tokenRows ?? []) {
        if (queuedTokens.has(row.token)) continue; // steal already queued for this token
        queuedTokens.add(row.token);
        messages.push({
          to:        row.token,
          title:     `${actorUsername} captured zones near you`,
          body:      `${actorDisplayName} just claimed ${cellsCaptured} hexes nearby`,
          data:      { type: 'friend_capture', activity_id: activityId, owner_id: actorUserId },
          channelId: 'friends',
          priority:  'high',
          sound:     'default',
        });
      }
    }
  }

  if (messages.length > 0) {
    await sendExpoPush(messages, admin);
    console.log(`[push] sent: { steals: ${displaced.length}, friends: ${Math.max(0, messages.length - displaced.length)}, tokens: ${messages.length} }`);
  }
}

// ── Photo move ──────────────────────────────────────────────────────────────

// Move pre-uploaded draft photos out of <user>/draft/<localId>/ into the
// activity's final folder <user>/<activity_id>/, then record one row per photo
// in activity_photos. Each move/insert is independent so one bad photo doesn't
// take down the rest.
async function moveAndRecordPhotos(
  // deno-lint-ignore no-explicit-any
  admin: any,
  opts: { userId: string; activityId: string; draftPaths: string[] },
): Promise<void> {
  const { userId, activityId, draftPaths } = opts;
  const bucket = admin.storage.from('activity-photos');

  for (let i = 0; i < draftPaths.length; i++) {
    const draftPath = draftPaths[i];
    // Defensive: only accept paths that start with the caller's own folder.
    if (!draftPath.startsWith(`${userId}/`)) {
      console.warn(`[photos] skipping non-owned path: ${draftPath}`);
      continue;
    }
    const ext = draftPath.split('.').pop() ?? 'jpg';
    const finalPath = `${userId}/${activityId}/${i}.${ext}`;
    try {
      const { error: moveErr } = await bucket.move(draftPath, finalPath);
      if (moveErr) {
        console.warn(`[photos] move failed for ${draftPath}: ${moveErr.message}`);
        continue;
      }
      const { error: insertErr } = await admin.from('activity_photos').insert({
        activity_id:  activityId,
        user_id:      userId,
        storage_path: finalPath,
        position:     i,
      });
      if (insertErr) {
        console.warn(`[photos] insert failed for ${finalPath}: ${insertErr.message}`);
      }
    } catch (e) {
      console.warn(`[photos] threw for ${draftPath}:`, e instanceof Error ? e.message : e);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  // Identify the caller via their JWT
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  // Parse + Zod-validate request body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const parsed = SubmitSchema.safeParse(rawBody);
  if (!parsed.success) return json({ error: 'invalid', issues: parsed.error.issues }, 400);

  const {
    type,
    started_at,
    ended_at,
    trace,
    samples,
    client_calories,
    title,
    description,
    visibility,
    hide_pace,
    hide_calories,
    photo_paths,
  } = parsed.data;
  const coords = trace.coordinates as [number, number][];

  // ── Validation rules (all in JS, before any DB write) ──────────────────────

  if (coords.length < 20) return json({ error: 'too_few_points' }, 400);

  const durationS = Math.round(
    (new Date(ended_at).getTime() - new Date(started_at).getTime()) / 1000,
  );
  if (durationS < 60) return json({ error: 'too_short' }, 400);

  const distanceM = traceDistanceM(coords);
  if (distanceM < 250) return json({ error: 'too_short_distance' }, 400);

  if (samples.accuracy_m.length > 0) {
    const avgAccuracy = samples.accuracy_m.reduce((a, b) => a + b, 0) / samples.accuracy_m.length;
    if (avgAccuracy > 50) return json({ error: 'gps_quality' }, 400);
  }

  if (samples.timestamps.length >= 2) {
    let maxGap = 0;
    for (let i = 1; i < samples.timestamps.length; i++) {
      maxGap = Math.max(maxGap, (samples.timestamps[i] - samples.timestamps[i - 1]) / 1000);
    }
    if (maxGap > 120) return json({ error: 'discontinuous_trace' }, 400);
  }

  const avgSpeedKmh = (distanceM / 1000) / (durationS / 3600);
  if (avgSpeedKmh < 3 || avgSpeedKmh > 50) return json({ error: 'implausible_pace' }, 400);

  // ── Service-role client for writes ─────────────────────────────────────────

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── Insert activity row ─────────────────────────────────────────────────────

  const { data: activity, error: insertErr } = await admin
    .from('activities')
    .insert({
      user_id:       user.id,
      type,
      started_at,
      ended_at,
      duration_s:    durationS,
      distance_m:    distanceM,
      calories:      client_calories ?? null,
      trace:         `SRID=4326;${lineStringWkt(coords)}`,
      status:        'processing',
      title:         title ?? null,
      description:   description ?? null,
      visibility:    visibility ?? 'public',
      hide_pace:     hide_pace ?? false,
      hide_calories: hide_calories ?? false,
    })
    .select('id')
    .single();

  if (insertErr || !activity) {
    return json({ error: 'insert_failed', detail: insertErr?.message }, 500);
  }

  const activityId = activity.id as string;

  // ── Spatial pipeline ────────────────────────────────────────────────────────

  try {
    // 1. Simplify trace + build capture polygon in Postgres
    const { data: polygonGeoJson, error: polyErr } = await admin.rpc(
      'prepare_capture_polygon',
      { p_activity_id: activityId },
    );
    if (polyErr || !polygonGeoJson) throw new Error(polyErr?.message ?? 'polygon_failed');

    // 2. Compute H3 cells via h3-js v3 (pure JS, no WASM)
    //    PostGIS ST_AsGeoJSON returns [lng, lat]; h3-js v3 polyfill needs [lat, lng]
    const geoJsonRing = (polygonGeoJson as { coordinates: [number, number][][] }).coordinates[0];
    const h3Outer = geoJsonRing.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
    const cells: string[] = polyfill(h3Outer, H3_RESOLUTION);

    if (cells.length > MAX_CELLS) {
      await admin.from('activities')
        .update({ status: 'failed', rejection_reason: 'too_large' })
        .eq('id', activityId);
      return json({ error: 'too_large' }, 400);
    }

    // 3. Build WKT boundary strings for each cell
    //    cellToBoundary returns [lat, lng][]; WKT needs lng lat
    const cellDecimals = cells.map(h3ToBigIntStr);
    const boundaryWkts = cells.map(cell => {
      const boundary = h3ToGeoBoundary(cell) as [number, number][];
      return boundaryToWkt(boundary);
    });

    // 4. Atomic ownership claim
    const { data: captureResult, error: captureErr } = await admin.rpc('capture_activity', {
      p_activity_id:    activityId,
      p_cells:          cellDecimals,
      p_boundaries_wkt: boundaryWkts,
    });

    if (captureErr) throw new Error(captureErr.message);

    const result = (captureResult as { cells_captured: number; displaced: { owner_id: string; count: number }[] }[])?.[0]
      ?? { cells_captured: 0, displaced: [] };

    // Best-effort: snap raw GPS to roads via Mapbox so the map shows a clean
    // street-following polyline. Never fail the request if matching errors.
    try {
      const matchedGeom = await matchToRoads(coords);
      if (matchedGeom) {
        await admin.rpc('set_matched_trace', {
          p_activity_id:     activityId,
          p_matched_geojson: matchedGeom,
        });
      }
    } catch (e) {
      console.error('[submit-activity] map-matching failed:', e instanceof Error ? e.message : e);
    }

    // Best-effort: move pre-uploaded draft photos into the activity's final folder
    // and record them in activity_photos. Never fail the submit if a photo errors.
    if (photo_paths && photo_paths.length > 0) {
      try {
        await moveAndRecordPhotos(admin, {
          userId: user.id,
          activityId,
          draftPaths: photo_paths,
        });
      } catch (e) {
        console.error('[submit-activity] photo move failed:', e instanceof Error ? e.message : e);
      }
    }

    // Best-effort: push notifications to displaced owners and followers.
    try {
      await fanOutNotifications(admin, {
        activityId,
        actorUserId:   user.id,
        cellsCaptured: result.cells_captured,
        displaced:     result.displaced ?? [],
      });
    } catch (e) {
      console.error('[submit-activity] push fan-out failed:', e instanceof Error ? e.message : e);
    }

    return json({
      activity_id:    activityId,
      cells_captured: result.cells_captured,
      cells_lost:     result.displaced ?? [],
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[submit-activity] capture pipeline failed:', message, err instanceof Error ? err.stack : '');
    await admin.from('activities')
      .update({ status: 'failed', rejection_reason: message.slice(0, 200) })
      .eq('id', activityId);
    return json({ error: 'capture_failed', detail: message }, 500);
  }
});
