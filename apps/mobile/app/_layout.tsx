import '../global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { initSentry } from '@/lib/sentry';
import { initAnalytics } from '@/lib/analytics';

initSentry();
initAnalytics();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => setSession(s))
      .catch(() => {/* treat failed session check as logged out */})
      .finally(() => setLoaded(true));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const inAuth = segments[0] === '(auth)';
    const inCallback = segments[0] === 'auth-callback';
    // Don't interfere while auth-callback is processing tokens
    if (inCallback) return;
    if (!session && !inAuth) router.replace('/(auth)/sign-in');
    else if (session && inAuth) router.replace('/(app)/map');
  }, [session, loaded, segments]);

  if (!loaded) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="auth-callback" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
