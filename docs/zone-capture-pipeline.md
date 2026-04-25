# Zone capture pipeline

The most technically interesting part of Ilaaka. This document specifies how a GPS trace becomes claimed territory.

## High-level flow

```
[Mobile]                       [Edge Function]                    [Postgres]
   │                                  │                                │
   │  POST /submit-activity           │                                │
   │  { type, started_at, ended_at,   │                                │
   │    trace: GeoJSON LineString,    │                                │
   │    samples: [...]  }             │                                │
   ├─────────────────────────────────→│                                │
   │                                  │ Validate (Zod)                 │
   │                                  │ Reject if too short            │
   │                                  │                                │
   │                                  │  insert activities (status=    │
   │                                  │  processing) ─────────────────→│
   │                                  │                                │
   │                                  │  Run capture_activity(id) ────→│
   │                                  │  (PL/pgSQL function:           │
   │                                  │   simplify, polygonize,        │
   │                                  │   extract H3 cells, upsert     │
   │                                  │   ownership, write history)    │
   │                                  │                                │
   │                                  │  ←─ {captured, displaced[]} ───│
   │                                  │                                │
   │                                  │ Send Expo Push to displaced    │
   │                                  │                                │
   │  ←── 200 { activity_id,          │                                │
   │           cells_captured,        │                                │
   │           cells_lost: [{owner,   │                                │
   │           hex_count}, ...] }     │                                │
```

**SLA target:** <5s p95 wall-clock for traces under 60 minutes.
**Wall-clock budget:** 60s (Supabase Edge Function limit). Plenty of headroom.

## Input contract

The mobile app POSTs to `POST /functions/v1/submit-activity` with a Bearer JWT.

```typescript
type SubmitActivityRequest = {
  type: 'run' | 'walk' | 'cycle' | 'hike';
  started_at: string;          // ISO 8601
  ended_at: string;            // ISO 8601
  trace: {                     // GeoJSON LineString in WGS84
    type: 'LineString';
    coordinates: [number, number][];   // [[lng, lat], ...]
  };
  samples: {                   // optional rich samples for the future
    timestamps: number[];      // unix ms
    accuracy_m: number[];      // GPS accuracy per point
  };
  client_calories?: number;    // mobile's MET-based estimate; server may override
};
```

## Validation rules (reject early)

Before any spatial work:

| Rule | Threshold | Reject reason |
| --- | --- | --- |
| Point count | <20 points | `too_few_points` |
| Duration | <60s | `too_short` |
| Distance | <250m | `too_short_distance` |
| Avg accuracy | >50m | `gps_quality` |
| Max gap between points | >120s | `discontinuous_trace` |
| Average pace | <3 km/h or >50 km/h | `implausible_pace` (likely vehicle) |

Rejected activities are still stored (`status='rejected'` with `rejection_reason`) for analytics, but no zones are computed.

## Spatial pipeline

### 1. Simplify the trace

GPS jitter inflates the polygon and burns compute. Use Postgres:

```sql
-- inside capture_activity()
update activities
set simplified = st_simplifypreservetopology(trace, 0.00005)   -- ~5m tolerance at equator
where id = $1;
```

`0.00005` degrees ≈ 5m. Good balance for fitness pace.

### 2. Build the capture polygon

Two cases:

**Closed loop** (start and end are within 30m of each other):

```sql
with closed as (
  select st_makepolygon(st_addpoint(simplified, st_startpoint(simplified))) as poly
  from activities where id = $1
)
update activities set capture_polygon = closed.poly from closed where id = $1;
```

**Open route** (perimeter capture per PRD §4.1.1):

```sql
update activities
set capture_polygon = st_buffer(simplified::geography, 25)::geometry  -- 25m corridor
where id = $1
  and capture_polygon is null;
```

Detect which case via `st_distance(st_startpoint(trace), st_endpoint(trace)) < 30`. Use ::geography for the buffer so the radius is in meters.

### 3. Extract H3 cells

```sql
with cells as (
  select unnest(h3_polygon_to_cells(a.capture_polygon, 11)) as h3
  from activities a
  where a.id = $1
)
select array_agg(h3) from cells;
```

Reject if the array length is below the minimum capture threshold (3 cells ≈ 5,000 sqm).

### 4. Upsert ownership and history in one transaction

This is the core write. Atomically:
- Read the current owners of every captured cell.
- Insert/update `zone_ownership` with the new owner.
- Close history rows for displaced owners (set `owned_to = now()`).
- Insert new history rows for the current activity.

Encapsulate this in a PL/pgSQL function called by the Edge Function:

```sql
create or replace function public.capture_activity(p_activity_id uuid)
returns table (
  cells_captured integer,
  displaced jsonb     -- [{ owner_id, count }, ...]
)
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_cells bigint[];
  v_displaced jsonb;
begin
  select user_id into v_user_id from public.activities where id = p_activity_id;
  if v_user_id is null then
    raise exception 'activity not found: %', p_activity_id;
  end if;

  -- Extract cells
  select array_agg(c) into v_cells
  from (
    select unnest(h3_polygon_to_cells(capture_polygon, 11)) as c
    from public.activities where id = p_activity_id
  ) t;

  if v_cells is null or array_length(v_cells, 1) < 3 then
    update public.activities
       set status = 'rejected',
           rejection_reason = 'too_few_cells',
           cells_captured = coalesce(array_length(v_cells, 1), 0)
     where id = p_activity_id;
    return query select 0::int, '[]'::jsonb;
    return;
  end if;

  -- Capture displaced owners before overwriting (excluding self-recapture)
  select coalesce(jsonb_agg(jsonb_build_object('owner_id', owner_id, 'count', cnt)), '[]'::jsonb)
  into v_displaced
  from (
    select owner_id, count(*) as cnt
    from public.zone_ownership
    where h3_index = any(v_cells)
      and owner_id <> v_user_id
    group by owner_id
  ) d;

  -- Close history for displaced rows
  update public.zone_ownership_history h
     set owned_to = now()
    from public.zone_ownership zo
   where zo.h3_index = any(v_cells)
     and h.h3_index = zo.h3_index
     and h.owner_id = zo.owner_id
     and h.owned_to is null
     and zo.owner_id <> v_user_id;

  -- Upsert ownership
  insert into public.zone_ownership (h3_index, owner_id, captured_at, captured_via, expires_at)
  select c, v_user_id, now(), p_activity_id, now() + interval '14 days'
    from unnest(v_cells) as c
  on conflict (h3_index)
  do update set
    owner_id = excluded.owner_id,
    captured_at = excluded.captured_at,
    captured_via = excluded.captured_via,
    expires_at = excluded.expires_at;

  -- New history rows for this activity
  insert into public.zone_ownership_history (h3_index, owner_id, captured_via, owned_from)
  select c, v_user_id, p_activity_id, now()
    from unnest(v_cells) as c;

  -- Mark activity processed
  update public.activities
     set status = 'processed',
         cells_captured = array_length(v_cells, 1),
         cells_lost = (select sum((d->>'count')::int) from jsonb_array_elements(v_displaced) d)
   where id = p_activity_id;

  return query select array_length(v_cells, 1), v_displaced;
end;
$$;

grant execute on function public.capture_activity(uuid) to service_role;
```

Note: `security definer` lets this run with the function owner's privileges and bypass RLS as needed for the writes. Only the service role can execute it.

### 5. Push notifications

Once the function returns the `displaced` JSONB, the Edge Function fans out Expo Push messages:

```typescript
// supabase/functions/submit-activity/push.ts
type Displaced = { owner_id: string; count: number };

export async function notifyDisplacedOwners(
  supabase: ReturnType<typeof createClient>,
  capturer: { username: string },
  displaced: Displaced[],
) {
  if (!displaced.length) return;

  const ownerIds = displaced.map((d) => d.owner_id);
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', ownerIds);

  if (!tokens?.length) return;

  const messages = tokens.map((t) => {
    const lostCount = displaced.find((d) => d.owner_id === t.user_id)?.count ?? 0;
    return {
      to: t.token,
      sound: 'default',
      title: 'Your zone was captured!',
      body: `${capturer.username} captured ${lostCount} of your hexes.`,
      data: { type: 'zone_lost', captured_by: capturer.username, count: lostCount },
    };
  });

  // Expo accepts batches of up to 100 in a single request.
  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}`,
      },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }
}
```

`EXPO_ACCESS_TOKEN` is created in the Expo dashboard under Access Tokens.

Throttling (PRD §4.1.3 — max 5 steal notifications per hour per user) is **not** enforced in v0. Add a Redis-backed counter or a Postgres rate-limit table in v0.5 if it becomes a problem.

## Edge Function skeleton

```typescript
// supabase/functions/submit-activity/index.ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3';
import { notifyDisplacedOwners } from './push.ts';

const SubmitSchema = z.object({
  type: z.enum(['run', 'walk', 'cycle', 'hike']),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  trace: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(z.tuple([z.number(), z.number()])).min(20),
  }),
  client_calories: z.number().optional(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  // User-context client to identify the caller
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  // Parse + validate
  const body = await req.json();
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'invalid', issues: parsed.error.issues }, 400);

  const { trace, type, started_at, ended_at, client_calories } = parsed.data;

  // Service-role client for writes
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Compute distance + duration in JS (cheap; avoids a DB round-trip just for validation)
  const durationS = Math.round(
    (new Date(ended_at).getTime() - new Date(started_at).getTime()) / 1000,
  );
  if (durationS < 60) return json({ error: 'too_short' }, 400);

  const distanceM = haversineLength(trace.coordinates);
  if (distanceM < 250) return json({ error: 'too_short_distance' }, 400);

  // Insert the activity row
  const { data: activity, error: insertErr } = await admin
    .from('activities')
    .insert({
      user_id: user.id,
      type,
      started_at,
      ended_at,
      duration_s: durationS,
      distance_m: distanceM,
      calories: client_calories ?? null,
      trace: `SRID=4326;${lineStringWkt(trace.coordinates)}`,
      status: 'processing',
    })
    .select('id')
    .single();
  if (insertErr || !activity) return json({ error: 'insert_failed', detail: insertErr?.message }, 500);

  // Run the capture function
  const { data: captureResult, error: captureErr } = await admin.rpc('capture_activity', {
    p_activity_id: activity.id,
  });
  if (captureErr) {
    await admin.from('activities').update({ status: 'failed' }).eq('id', activity.id);
    return json({ error: 'capture_failed', detail: captureErr.message }, 500);
  }

  const result = captureResult?.[0] ?? { cells_captured: 0, displaced: [] };

  // Fire push (non-blocking; we don't fail the request if push fails)
  if (result.displaced && result.displaced.length > 0) {
    const { data: profile } = await admin
      .from('profiles').select('username').eq('id', user.id).single();
    if (profile) {
      // Fire-and-forget — do NOT await in production hot path.
      notifyDisplacedOwners(admin, profile, result.displaced)
        .catch((e) => console.error('push fanout failed', e));
    }
  }

  return json({
    activity_id: activity.id,
    cells_captured: result.cells_captured,
    cells_lost: result.displaced ?? [],
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function haversineLength(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const R = 6_371_000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(a));
  }
  return total;
}

function lineStringWkt(coords: [number, number][]): string {
  return `LINESTRING(${coords.map(([x, y]) => `${x} ${y}`).join(', ')})`;
}
```

## Failure modes — what to handle

| Failure | Handling |
| --- | --- |
| User submits same trace twice (network retry) | Add a client-generated `idempotency_key` column on `activities`; reject duplicates. |
| `h3_polygon_to_cells` returns an absurd number of cells (massive trace) | Hard cap at 50,000 cells per activity. Reject as `too_large`. |
| Edge Function timeout | Set internal soft timeout at 50s; if hit, mark activity `failed` and return 503. |
| Polygon construction fails (self-intersecting trace) | Catch in `capture_activity`; fall back to perimeter buffer. |
| Push fanout partially fails | Log to Sentry, don't fail the request. Ownership has already been written. |

## Future: async via Inngest (v1+)

When the edge function consistently exceeds 5s, lift the spatial pipeline into Inngest:

1. `submit-activity` becomes a thin endpoint: validate, insert with status='processing', enqueue Inngest event, return 202.
2. Inngest function calls `capture_activity()` and `notifyDisplacedOwners`.
3. Mobile polls `GET /activities/:id` or subscribes to the Realtime channel `activity:<id>` for status updates.

The DB function and push code don't change. The migration is purely about *who* invokes them.
