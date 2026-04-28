import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, Footprints, Bike, Shuffle } from 'lucide-react-native';
import { useAuthStore } from '@/stores/auth-store';
import { updateProfileTier1 } from '@/lib/users';
import { capture } from '@/lib/analytics';
import { OnboardingProgressBar } from '@/components/onboarding/ProgressBar';
import type { ActivityType } from '@/types/api';

type IconComponent = React.ComponentType<{ color: string; size: number }>;

type Choice = { key: ActivityType | 'mix'; label: string; Icon: IconComponent };

const CHOICES: Choice[] = [
  { key: 'walk',  label: 'Walk',      Icon: Footprints },
  { key: 'run',   label: 'Run',       Icon: Activity   },
  { key: 'cycle', label: 'Cycle',     Icon: Bike       },
  { key: 'mix',   label: 'Mix it up', Icon: Shuffle    },
];

export default function ActivityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ username?: string; locality?: string }>();
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [choice, setChoice] = useState<Choice['key'] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    if (!choice || !user) return;
    const username = params.username?.toString();
    const locality = params.locality?.toString();
    if (!username || !locality) {
      Alert.alert('Missing info', 'Restart onboarding from the start.');
      router.replace('/(onboarding)/username');
      return;
    }
    const primary: ActivityType | null = choice === 'mix' ? null : choice;
    setSubmitting(true);
    try {
      const updated = await updateProfileTier1(user.id, {
        username,
        usual_locality: locality,
        primary_activity: primary,
      });
      setProfile(updated);
      capture('onboarding_question_answered', {
        tier: 1,
        question: 'primary_activity',
        value: primary ?? 'mix',
      });
      capture('onboarding_completed', { tier_1_complete: true });
      router.replace('/(onboarding)/permissions');
      // Best-effort: re-pull profile so any DB-side defaults flow back.
      refreshProfile().catch(() => {});
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Couldn’t save.';
      Alert.alert('Save failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4">
        <OnboardingProgressBar step={3} total={4} />
      </View>

      <View className="flex-1 px-6 pt-10">
        <Text className="text-3xl font-bold text-gray-900 mb-3">
          What's your usual move?
        </Text>
        <Text className="text-gray-500 mb-8">
          We'll set this as your default — you can change it any time you record.
        </Text>

        <View className="flex-row flex-wrap -mx-1.5">
          {CHOICES.map(({ key, label, Icon }) => {
            const active = choice === key;
            return (
              <View key={key} className="w-1/2 px-1.5 mb-3">
                <TouchableOpacity
                  onPress={() => setChoice(key)}
                  className={`rounded-2xl border py-8 items-center ${
                    active ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-gray-200'
                  }`}
                >
                  <Icon color={active ? '#fff' : '#6B7280'} size={36} />
                  <Text
                    className={`mt-3 text-base font-semibold ${
                      active ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>

      <View className="px-6 pb-8">
        <TouchableOpacity
          className={`rounded-xl py-4 items-center ${
            choice && !submitting ? 'bg-indigo-500' : 'bg-gray-200'
          }`}
          onPress={handleContinue}
          disabled={!choice || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              className={`font-semibold text-base ${
                choice ? 'text-white' : 'text-gray-400'
              }`}
            >
              Let's go
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
