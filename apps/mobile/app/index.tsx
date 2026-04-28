import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth-store';

// Default route after splash. The root _layout has already loaded the session
// (and best-effort the profile) before this renders, so we can read the store
// synchronously and pick the right destination. The root layout's gate effect
// is the source of truth for onboarding routing — this avoids one extra hop
// when we already have enough info.
export default function Index() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (profile && !profile.onboarding_completed_at) {
    return <Redirect href="/(onboarding)/username" />;
  }
  return <Redirect href="/(app)/map" />;
}
