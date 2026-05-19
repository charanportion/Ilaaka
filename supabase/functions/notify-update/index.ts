import { createClient } from '@supabase/supabase-js';
import { sendExpoPush, type ExpoPushMessage } from '../_shared/expo-push.ts';

// Reuse the weekly-stats CORS approach for parity.
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

type Body = {
  /** Required. The new app version users should install (e.g. "1.0.2"). */
  version?: string;
  /** Optional override for the notification title. */
  title?: string;
  /** Optional override for the notification body. */
  body?: string;
  /** Optional install URL. Defaults to the public landing /install page. */
  installUrl?: string;
  /** Dry-run: returns the targeted user/token count without sending. */
  dryRun?: boolean;
};

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Service-role only (same gate as weekly-stats).
  const auth = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const isExactKey = serviceKey.length > 0 && auth === `Bearer ${serviceKey}`;
  let isServiceRoleClaim = false;
  if (!isExactKey && auth.startsWith('Bearer ')) {
    try {
      const claims = JSON.parse(atob(auth.slice(7).split('.')[1] ?? ''));
      isServiceRoleClaim = claims?.role === 'service_role';
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

  let input: Body = {};
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      input = await req.json();
    }
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const version = input.version?.trim();
  if (!version) {
    return new Response(JSON.stringify({ error: 'version_required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const title = input.title?.trim() || `Ilaaka v${version} is out`;
  const body = input.body?.trim()
    || 'Tap to download the latest APK. The new build replaces the current app and keeps your zones, friends, and history intact.';
  const installUrl = input.installUrl?.trim() || 'https://ilaaka.dotportion.com/install';

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // APK distribution is Android-only — never spam iOS users.
  const { data: tokenRows, error: tokenErr } = await admin
    .from('push_tokens')
    .select('token, user_id')
    .eq('platform', 'android');
  if (tokenErr) {
    console.error('[notify-update] push_tokens fetch failed:', tokenErr.message);
    return new Response(JSON.stringify({ error: 'tokens_fetch_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rows = tokenRows ?? [];
  const users = new Set<string>();
  const messages: ExpoPushMessage[] = [];
  for (const r of rows) {
    users.add(r.user_id);
    messages.push({
      to: r.token,
      title,
      body,
      data: { type: 'update_available', version, installUrl },
      channelId: 'stats',
      priority: 'high',
      sound: 'default',
    });
  }

  if (input.dryRun) {
    return new Response(
      JSON.stringify({ dryRun: true, users: users.size, messages: messages.length, version }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  await sendExpoPush(messages, admin);
  console.log(`[notify-update] sent: { version: ${version}, users: ${users.size}, messages: ${messages.length} }`);

  return new Response(
    JSON.stringify({ users: users.size, sent: messages.length, version }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
