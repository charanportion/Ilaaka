import { useEffect } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ access_token?: string; refresh_token?: string }>();

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Web: detectSessionInUrl:true means Supabase already parsed the hash tokens
      // on page load. Wait for onAuthStateChange to confirm the session, then navigate.
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        sub.subscription.unsubscribe();
        router.replace(session ? '/(app)/map' : '/(auth)/sign-in');
      });
      return () => sub.subscription.unsubscribe();
    }

    // Native: tokens arrive as URL params from the deep-link redirect
    async function handleNativeCallback() {
      const { access_token, refresh_token } = params;
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
      router.replace('/(app)/map');
    }
    handleNativeCallback();
  }, []);

  return (
    <View className="flex-1 justify-center items-center bg-white">
      <ActivityIndicator size="large" color="#7F77DD" />
    </View>
  );
}
