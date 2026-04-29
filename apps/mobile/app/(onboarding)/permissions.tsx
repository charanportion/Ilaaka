import { useState } from 'react';
import {
  Linking,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { MapPin, Navigation, Bell } from 'lucide-react-native';
import { capture } from '@/lib/analytics';
import { registerPushTokenForUser } from '@/lib/push';
import { OnboardingProgressBar } from '@/components/onboarding/ProgressBar';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useTokens } from '@/lib/useTokens';

type Step = 'foreground' | 'background' | 'notifications';
type Outcome = 'idle' | 'pending' | 'granted' | 'denied';

type IconComponent = React.ComponentType<{ color: string; size: number }>;

const COPY: Record<Step, {
  title: string;
  body: string;
  cta: string;
  Icon: IconComponent;
}> = {
  foreground: {
    title: 'Track your activities',
    body: 'Ilaaka uses your location only while you’re recording an activity. Without it, we can’t paint your zones.',
    cta: 'Allow location',
    Icon: MapPin,
  },
  background: {
    title: 'Keep tracking with the screen off',
    body: 'To capture your full route even if your screen turns off, we need background access.',
    cta: 'Allow background',
    Icon: Navigation,
  },
  notifications: {
    title: 'Know when zones change',
    body: 'Get alerted when someone captures your zones, or when a friend lights up nearby. You can change this any time.',
    cta: 'Allow notifications',
    Icon: Bell,
  },
};

const KIND: Record<Step, string> = {
  foreground: 'location_foreground',
  background: 'location_background',
  notifications: 'notifications',
};

export default function PermissionsScreen() {
  const router = useRouter();
  const { colors } = useTokens();
  const [step, setStep] = useState<Step>('foreground');
  const [outcome, setOutcome] = useState<Outcome>('idle');

  function next() {
    if (step === 'foreground') {
      setStep('background');
      setOutcome('idle');
    } else if (step === 'background') {
      setStep('notifications');
      setOutcome('idle');
    } else {
      router.replace('/(app)/map');
    }
  }

  async function handleRequest() {
    setOutcome('pending');
    capture('permission_requested', { kind: KIND[step] });
    try {
      let granted = false;
      if (step === 'foreground') {
        const res = await Location.requestForegroundPermissionsAsync();
        granted = res.status === 'granted';
      } else if (step === 'background') {
        const res = await Location.requestBackgroundPermissionsAsync();
        granted = res.status === 'granted';
      } else {
        const token = await registerPushTokenForUser();
        granted = token != null;
      }
      capture(granted ? 'permission_granted' : 'permission_denied', {
        kind: KIND[step],
      });
      setOutcome(granted ? 'granted' : 'denied');
      if (granted) {
        setTimeout(next, 350);
      }
    } catch {
      capture('permission_denied', { kind: KIND[step] });
      setOutcome('denied');
    }
  }

  function handleSkip() {
    capture('permission_skipped', { kind: KIND[step] });
    next();
  }

  const required = step !== 'notifications';
  const { title, body, cta, Icon } = COPY[step];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="px-6 pt-4">
        <OnboardingProgressBar step={4} total={4} />
      </View>

      <View className="flex-1 px-6 pt-12">
        <View
          style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.surface,
            borderWidth: 1, borderColor: colors.border,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <Icon color={colors.accent} size={28} />
        </View>
        <Text variant="h1" tone="strong" style={{ marginBottom: 12 }}>{title}</Text>
        <Text variant="bodyLg" tone="muted">{body}</Text>

        {outcome === 'denied' && (
          <View
            style={{
              marginTop: 24, padding: 16, borderRadius: 16,
              backgroundColor: colors.surface,
              borderWidth: 1, borderColor: colors.warning,
            }}
          >
            <Text variant="captionStrong" tone="warning" style={{ marginBottom: 8 }}>
              {required ? 'Permission denied' : 'Notifications off'}
            </Text>
            <Text variant="caption" tone="muted">
              {required
                ? "You can still use Ilaaka, but recording won't work until this is enabled. Open Settings to change it."
                : "No problem — you can turn this on later from Settings."}
            </Text>
            {required && (
              <TouchableOpacity
                onPress={() => Linking.openSettings()}
                className="mt-3 self-start"
              >
                <Text variant="captionStrong" tone="warning">Open Settings</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View className="px-6 pb-8">
        <Button
          label={outcome === 'denied' ? 'Continue' : cta}
          variant="primary"
          size="lg"
          fullWidth
          loading={outcome === 'pending'}
          onPress={outcome === 'denied' ? next : handleRequest}
          style={{ marginBottom: 12 }}
        />

        {outcome !== 'pending' && outcome !== 'granted' && (
          <TouchableOpacity onPress={handleSkip} className="py-3 items-center">
            <Text variant="captionStrong" tone="muted">Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
