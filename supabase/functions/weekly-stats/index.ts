import { createClient } from '@supabase/supabase-js';
import { sendExpoPush, type ExpoPushMessage } from '../_shared/expo-push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // pg_cron / authorized callers only — must present a service-role JWT.
  // Supabase platform already verifies the JWT signature; we just check role.
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return new Response('unauthorized', { status: 401, headers: corsHeaders });
  }
  try {
    const payload = auth.slice(7).split('.')[1];
    const claims = JSON.parse(atob(payload));
    if (claims.role !== 'service_role') {
      return new Response('forbidden', { status: 403, headers: corsHeaders });
    }
  } catch {
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
