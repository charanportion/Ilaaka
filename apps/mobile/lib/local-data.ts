import { clearAllLocalData } from '@/db/trace-buffer';
import { useAuthStore } from '@/stores/auth-store';
import { useActivityStore } from '@/stores/activity-store';

// One-stop teardown of every piece of local user state. Called on sign-out and
// from the SIGNED_OUT auth state change so the next user signing in on the
// same device starts with a clean slate.
//
// Anything user-scoped that lives outside of supabase.auth (SQLite buffer,
// in-memory Zustand state, image cache, etc.) needs to be cleared here.
export async function clearLocalUserData(): Promise<void> {
  // SQLite trace buffer + pending activities
  try {
    clearAllLocalData();
  } catch (e) {
    if (__DEV__) console.warn('[clearLocalUserData] sqlite clear failed', e);
  }

  // Zustand stores — reset to initial state without re-running module init
  useAuthStore.setState({ session: null, user: null, profile: null });
  useActivityStore.setState({
    isRecording: false,
    isPaused: false,
    hasPending: false,
    points: [],
    startedAt: null,
    localId: null,
    distanceM: 0,
    durationS: 0,
  });
}
