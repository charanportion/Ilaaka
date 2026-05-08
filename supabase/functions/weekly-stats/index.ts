import { createClient } from '@supabase/supabase-js';
import { sendExpoPush, type ExpoPushMessage } from '../_shared/expo-push.ts';

// CORS allowlist — same approach as submit-activity. Empty Origin (server-to-server
// pg_cron callers) is always allowed.
const ALLOWED_ORIGINS = (Deno.env.get('CORS_ALLOWED_ORIGINS') ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);

function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const allow = !origin || ALLOWED_ORIGINS.includes(origin) ? (origin ?? '') : '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function formatKm(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function formatHa(m2: number): string {
  return m2 < 10_000 ? `${m2.toLocaleString()} m²` : `${(m2 / 10_000).toFixed(2)} ha`;
}

type WeeklyStats = {
  distance_m:     number | string;
  area_m2:        number | string;
  activity_count: number;
  cells_won:      number;
  cells_lost:     number;
};

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // pg_cron / authorized callers only. Supabase has already verified the JWT
  // signature when proxying the request; we just need to confirm the role.
  // Two acceptable callers:
  //   1) Bearer matches our service role key byte-for-byte (manual cron / admin tools)
  //   2) Bearer is a JWT whose 'role' claim is 'service_role' (pg_cron via supabase_url)
  const auth = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const isExactKey = serviceKey.length > 0 && auth === `Bearer ${serviceKey}`;
  let isServiceRoleClaim = false;
  if (!isExactKey && auth.startsWith('Bearer ')) {
    try {
      const claims = JSON.parse(atob(auth.slice(7).split('.')[1] ?? ''));
      isServiceRoleClaim = claims?.role === 'service_role';
      // Reject expired tokens explicitly even if the role claim is right.
      if (isServiceRoleClaim && typeof claims?.exp === 'number') {
        if (claims.exp < Math.floor(Date.now() / 1000)) isServiceRoleClaim = false;
      }
    } catch {
      isServiceRoleClaim = false;
    }
  }
  if (!isExactKey && !isServiceRoleClaim) {
    return new Response('unauthorized', { status: 401, headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 1. Group push tokens by user.
  const { data: tokenRows, error: tokenErr } = await admin
    .from('push_tokens')
    .select('token, user_id');
  if (tokenErr) {
    console.error('[weekly-stats] push_tokens fetch failed:', tokenErr.message);
    return new Response(JSON.stringify({ error: 'tokens_fetch_failed' }), {
      status:  500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const byUser = new Map<string, string[]>();
  for (const r of tokenRows ?? []) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r.token);
    byUser.set(r.user_id, list);
  }

  // 2. Build messages per user (skip users with zero activity this week).
  const messages: ExpoPushMessage[] = [];
  for (const [userId, tokens] of byUser.entries()) {
    const { data, error } = await admin.rpc('weekly_stats_for_user', { p_user_id: userId });
    if (error) {
      console.warn(`[weekly-stats] stats failed for ${userId.slice(0, 8)}…:`, error.message);
      continue;
    }
    const s = (data as WeeklyStats[] | null)?.[0];
    if (!s || s.activity_count === 0) continue;

    const km   = formatKm(Number(s.distance_m));
    const ha   = formatHa(Number(s.area_m2));
    const won  = Number(s.cells_won);
    const lost = Number(s.cells_lost);
    const tail = lost > 0
      ? `Won ${won} hexes, lost ${lost}.`
      : `Won ${won} hexes this week.`;

    for (const token of tokens) {
      messages.push({
        to:        token,
        title:     'Your Ilaaka week',
        body:      `${km} walked · ${ha} held · ${tail}`,
        data:      { type: 'weekly_stats' },
        channelId: 'stats',
        priority:  'high',
        sound:     'default',
      });
    }
  }

  await sendExpoPush(messages, admin);
  console.log(`[weekly-stats] sent: { users: ${byUser.size}, messages: ${messages.length} }`);

  return new Response(
    JSON.stringify({ users: byUser.size, sent: messages.length }),
    {
      status:  200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
