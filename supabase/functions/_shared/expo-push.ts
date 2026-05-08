import type { SupabaseClient } from '@supabase/supabase-js';

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: 'steals' | 'friends' | 'stats';
  priority?: 'high';
  sound?: 'default';
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

export async function sendExpoPush(
  messages: ExpoPushMessage[],
  admin: SupabaseClient,
): Promise<void> {
  if (messages.length === 0) return;

  const token = Deno.env.get('EXPO_ACCESS_TOKEN');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Send in batches of BATCH_SIZE
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });

      if (!res.ok) {
        console.warn(`[expo-push] HTTP ${res.status} for batch of ${batch.length}`);
        continue;
      }

      const body = await res.json();
      const ticketData: unknown[] = body?.data ?? [];

      // Check for DeviceNotRegistered errors and clean up dead tokens
      const deadTokens: string[] = [];
      ticketData.forEach((ticket: unknown, idx: number) => {
        const t = ticket as { status?: string; details?: { error?: string } };
        if (
          t?.status === 'error' &&
          t?.details?.error === 'DeviceNotRegistered'
        ) {
          const deadToken = batch[idx]?.to;
          if (deadToken) deadTokens.push(deadToken);
        }
      });

      if (deadTokens.length > 0) {
        console.log(`[expo-push] cleaning ${deadTokens.length} dead token(s)`);
        await admin.from('push_tokens').delete().in('token', deadTokens);
      }
    } catch (e) {
      console.warn('[expo-push] batch send failed:', e instanceof Error ? e.message : String(e));
    }
  }
}
