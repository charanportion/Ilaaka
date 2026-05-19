import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { capture } from '@/lib/analytics';

// Module-scope cache so logout cleanup can reach it without a prop-drill.
let _cachedToken: string | null = null;

export function getCachedPushToken(): string | null {
  return _cachedToken;
}

export async function registerPushTokenForUser(): Promise<string | null> {
  // Push is not supported on web.
  if (Platform.OS === 'web') return null;

  // Expo Go on Android cannot receive push — real push needs a dev build.
  if (Constants.appOwnership === 'expo') {
    console.warn('[push] registerPushTokenForUser: Expo Go detected — push requires a dev build');
    return null;
  }

  // Physical device only (simulator/emulator has no push capability).
  if (!Device.isDevice) {
    console.warn('[push] registerPushTokenForUser: not a physical device, skipping');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    capture('push_permission_denied', { platform: Platform.OS });
    return null;
  }

  // Android notification channels — must exist before any push arrives.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('steals', {
      name: 'Zone steals',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync('friends', {
      name: 'Friend activity',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('stats', {
      name: 'Weekly summary',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    console.warn('[push] missing EAS projectId in app.json extra.eas.projectId');
    return null;
  }

  const expoPushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = expoPushToken.data;

  await supabase.rpc('upsert_push_token', {
    p_token:     token,
    p_platform:  Platform.OS,
    p_device_id: Device.modelName ?? null,
  });

  _cachedToken = token;
  capture('push_token_registered', { platform: Platform.OS, granted: true });
  return token;
}

export async function unregisterPushToken(token: string): Promise<void> {
  await supabase.from('push_tokens').delete().eq('token', token);
  if (_cachedToken === token) _cachedToken = null;
}

export function attachNotificationHandlers(): () => void {
  // Show notification banners even when the app is foregrounded.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert:  true,
      shouldShowBanner: true,
      shouldShowList:   true,
      shouldPlaySound:  true,
      shouldSetBadge:   false,
    }),
  });

  const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
    const type = (notification.request.content.data?.type as string | undefined) ?? 'unknown';
    capture('push_received', { type });
  });

  const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    const type = (data?.type as string | undefined) ?? 'unknown';
    capture('push_tapped', { type });

    // Update reminders deep-link to the install page in the browser — there's
    // no in-app upgrade path for direct APK distribution.
    if (type === 'update_available') {
      const installUrl =
        (data?.installUrl as string | undefined) ?? 'https://ilaaka.dotportion.com/install';
      Linking.openURL(installUrl).catch(() => {});
      return;
    }

    // Route by push type. Default = map.
    const target = type === 'weekly_stats' ? '/(app)/profile' : '/(app)/map';
    try {
      router.push(target);
    } catch {
      // Router may not be ready on cold-start; navigation will happen on next render.
    }
  });

  return () => {
    foregroundSub.remove();
    tapSub.remove();
  };
}
