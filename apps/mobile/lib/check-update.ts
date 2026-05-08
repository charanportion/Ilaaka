import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

const VERSION_URL = 'https://ilaaka.dotportion.com/api/version';
const DISMISS_KEY = 'update_prompt.dismissed';
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

const VersionSchema = z.object({
  latest: z.string(),
  minSupported: z.string(),
  downloadUrl: z.string().url(),
  releasedAt: z.string(),
});

export type VersionInfo = z.infer<typeof VersionSchema>;

export type UpdateStatus =
  | { status: 'ok'; current: string; latest: string }
  | { status: 'update_available'; current: string; info: VersionInfo }
  | { status: 'force_update'; current: string; info: VersionInfo };

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/**
 * Compare two semver-ish strings. Returns -1 if `a < b`, 0 if equal, 1 if
 * `a > b`. Tolerates non-numeric segments by coercing to 0.
 */
export function compareSemver(a: string, b: string): number {
  const parts = (s: string) => {
    const segs = s.split('.').map((p) => Number.parseInt(p, 10));
    return [segs[0] ?? 0, segs[1] ?? 0, segs[2] ?? 0];
  };
  const [a0, a1, a2] = parts(a);
  const [b0, b1, b2] = parts(b);
  if (a0 !== b0) return a0 < b0 ? -1 : 1;
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  return 0;
}

/**
 * Hit the version endpoint and decide what to do. Network failures are
 * non-fatal — we return `ok` so an offline user isn't blocked from
 * launching the app.
 */
export async function checkForUpdate(): Promise<UpdateStatus> {
  let info: VersionInfo;
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`http ${res.status}`);
    info = VersionSchema.parse(await res.json());
  } catch {
    return { status: 'ok', current: APP_VERSION, latest: APP_VERSION };
  }

  if (compareSemver(APP_VERSION, info.minSupported) < 0) {
    return { status: 'force_update', current: APP_VERSION, info };
  }
  if (compareSemver(APP_VERSION, info.latest) < 0) {
    return { status: 'update_available', current: APP_VERSION, info };
  }
  return { status: 'ok', current: APP_VERSION, latest: info.latest };
}

/** Mark this `latest` version as "remind me later" — suppresses the soft
 *  prompt for 24h. Has no effect on force_update. */
export async function dismissUpdatePrompt(latest: string): Promise<void> {
  const payload = JSON.stringify({ version: latest, at: Date.now() });
  await SecureStore.setItemAsync(DISMISS_KEY, payload);
}

/** Has the user already dismissed this exact `latest` version recently? */
export async function wasRecentlyDismissed(latest: string): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(DISMISS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { version?: string; at?: number };
    if (parsed.version !== latest || typeof parsed.at !== 'number') return false;
    return Date.now() - parsed.at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}
