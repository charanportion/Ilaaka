import { supabase } from './supabase';

// Detects PostgREST + Supabase auth errors that mean "your token is no good".
// PGRST301 = JWT expired; 401 / 403 are explicit auth failures. The Supabase
// SDK auto-refreshes proactively, but if a request was in-flight when the
// access token expired, the response will surface as one of these.
function isAuthError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; status?: number; message?: string; statusCode?: number };
  if (e.code === 'PGRST301' || e.code === 'PGRST302') return true;
  if (e.status === 401 || e.status === 403) return true;
  if (e.statusCode === 401 || e.statusCode === 403) return true;
  if (typeof e.message === 'string') {
    const m = e.message.toLowerCase();
    if (m.includes('jwt expired') || m.includes('invalid jwt')) return true;
  }
  return false;
}

// Wrap a fetcher that might fail with an expired/invalid token. Tries once,
// refreshes the session on auth errors, and retries. If the refresh itself
// fails, signs the user out so the app gracefully bounces back to sign-in
// instead of leaving the screen frozen on an opaque error.
export async function withAuthRetry<T>(fetcher: () => Promise<T>): Promise<T> {
  try {
    return await fetcher();
  } catch (err) {
    if (!isAuthError(err)) throw err;
    const { data, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !data.session) {
      // Refresh failed — token chain is dead. Sign the user out so they land
      // on the sign-in screen instead of seeing a confusing error.
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      throw refreshErr ?? err;
    }
    return await fetcher();
  }
}
