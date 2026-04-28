import '../global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { initSentry } from '@/lib/sentry';
import { initAnalytics } from '@/lib/analytics';
import { registerPushTokenForUser, attachNotificationHandlers } from '@/lib/push';

initSentry();
initAnalytics();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const setStoreSession = useAuthStore((s) => s.setSession);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const profile = useAuthStore((s) => s.profile);

  // Attach push notification foreground + tap handlers once at app root.
  useEffect(() => {
    const unsubscribe = attachNotificationHandlers();
    return unsubscribe;
  }, []);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setStoreSession(s);
        if (s) {
          refreshProfile().catch(() => {/* surfaced via gate fallback */});
          registerPushTokenForUser().catch(() => {/* non-fatal */});
        }
      })
      .catch(() => {/* treat failed session check as logged out */})
      .finally(() => setLoaded(true));

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setStoreSession(s);
      if (s && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        refreshProfile().catch(() => {});
        registerPushTokenForUser().catch(() => {/* non-fatal */});
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const inAuth = segments[0] === '(auth)';
    const inCallback = segments[0] === 'auth-callback';
    const inOnboarding = segments[0] === '(onboarding)';
    if (inCallback) return;
    if (!session) {
      if (!inAuth) router.replace('/(auth)/sign-in');
      return;
    }
    // Wait for the profile fetch to land before deciding onboarding vs app.
    // Without the profile we don't know whether the user has completed Tier 1.
    if (!profile) return;
    const onboardingDone = profile.onboarding_completed_at != null;
    // The permissions screen is the post-Q3 tail of onboarding. We set
    // onboarding_completed_at after Q3, so this screen is reachable while the
    // gate would otherwise treat the user as "done" and redirect to the app.
    // Whitelist it so the user can finish the permissions flow.
    const onPermissions = inOnboarding && segments[1] === 'permissions';
    if (!onboardingDone && !inOnboarding) {
      router.replace('/(onboarding)/username');
    } else if (onboardingDone && (inAuth || (inOnboarding && !onPermissions))) {
      router.replace('/(app)/map');
    }
  }, [session, profile, loaded, segments]);

  if (!loaded) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="auth-callback" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
