import { useEffect } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTokens } from '@/lib/useTokens';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ access_token?: string; refresh_token?: string }>();
  const { colors } = useTokens();

  useEffect(() => {
    if (Platform.OS === 'web') {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        sub.subscription.unsubscribe();
        router.replace(session ? '/(app)/map' : '/(auth)/sign-in');
      });
      return () => sub.subscription.unsubscribe();
    }

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
    <View className="flex-1 justify-center items-center bg-bg">
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}
