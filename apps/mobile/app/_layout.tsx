import '../global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import type { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';
import {
  Fraunces_700Bold,
  Fraunces_900Black,
  Fraunces_900Black_Italic,
} from '@expo-google-fonts/fraunces';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { initSentry } from '@/lib/sentry';
import { initAnalytics } from '@/lib/analytics';
import { registerPushTokenForUser, attachNotificationHandlers } from '@/lib/push';
import { clearLocalUserData } from '@/lib/local-data';
import { ThemeSyncer } from '@/components/theme/ThemeSyncer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import { useResolvedColorScheme } from '@/lib/theme';
import { darkPalette, lightPalette } from '@/lib/design-tokens';

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

  const [fontsLoaded] = useFonts({
    Fraunces_700Bold,
    Fraunces_900Black,
    Fraunces_900Black_Italic,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

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
      if (event === 'SIGNED_OUT') {
        // Clear local SQLite + Zustand state so the next user signing in on
        // this device doesn't inherit the previous user's data.
        clearLocalUserData().catch(() => {/* non-fatal */});
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const inAuth = segments[0] === '(auth)';
    const inCallback = segments[0] === 'auth-callback';
    const inOnboarding = segments[0] === '(onboarding)';
    const onBlocked = segments[0] === 'blocked';
    if (inCallback) return;
    if (!session) {
      if (!inAuth) router.replace('/(auth)/sign-in');
      return;
    }
    // Wait for the profile fetch to land before deciding onboarding vs app.
    // Without the profile we don't know whether the user has completed Tier 1.
    if (!profile) return;
    const onboardingDone = profile.onboarding_completed_at != null;
    const regionBlocked = profile.region_status === 'blocked';
    // The permissions screen is the post-Q3 tail of onboarding. We set
    // onboarding_completed_at after Q3, so this screen is reachable while the
    // gate would otherwise treat the user as "done" and redirect to the app.
    // Whitelist it so the user can finish the permissions flow.
    const onPermissions = inOnboarding && segments[1] === 'permissions';

    // Region gate trumps everything except onboarding-not-done. A blocked
    // user must always sit on the /blocked screen regardless of how they
    // try to navigate around it.
    if (onboardingDone && regionBlocked && !onBlocked) {
      router.replace('/blocked');
      return;
    }
    // Inverse: if they're allowed (or recheck flipped them to allowed)
    // and somehow ended up on /blocked, route them to the app.
    if (onboardingDone && !regionBlocked && onBlocked) {
      router.replace('/(app)/map');
      return;
    }
    if (!onboardingDone && !inOnboarding) {
      router.replace('/(onboarding)/username');
    } else if (onboardingDone && (inAuth || (inOnboarding && !onPermissions))) {
      router.replace('/(app)/map');
    }
  }, [session, profile, loaded, segments]);

  if (!loaded || !fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <ThemeSyncer />
      <ToastProvider>
        <ThemedShell />
      </ToastProvider>
    </ErrorBoundary>
  );
}

function buildNavTheme(scheme: 'light' | 'dark'): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const p = scheme === 'dark' ? darkPalette : lightPalette;
  return {
    ...base,
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      primary: p.accent,
      background: p.bg,
      card: p.surface,
      text: p.ink,
      border: p.border,
      notification: p.danger,
    },
  };
}

function ThemedShell() {
  const scheme = useResolvedColorScheme();
  return (
    <ThemeProvider value={buildNavTheme(scheme)}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="blocked" options={{ gestureEnabled: false }} />
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
