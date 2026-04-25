import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform, AppState } from 'react-native';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

// expo-secure-store calls native modules unavailable in web/SSR — require lazily
const secureStorage = isNative
  ? (() => {
      const SecureStore = require('expo-secure-store');
      return {
        getItem: (key: string) => SecureStore.getItemAsync(key) as Promise<string | null>,
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value) as Promise<void>,
        removeItem: (key: string) => SecureStore.deleteItemAsync(key) as Promise<void>,
      };
    })()
  : undefined;

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web', // auto-process hash tokens after web OAuth redirect
    },
  },
);

if (isNative) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
