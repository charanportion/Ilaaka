import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth-store';
import { isUsernameAvailable } from '@/lib/users';
import { capture } from '@/lib/analytics';
import { OnboardingProgressBar } from '@/components/onboarding/ProgressBar';

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
const MAX_LEN = 24;

function sanitize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_LEN);
}

type CheckState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';

export default function UsernameScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  const initial = useMemo(() => {
    const fromMeta = (user?.user_metadata?.full_name as string | undefined) ?? '';
    const seeded = sanitize(fromMeta);
    if (seeded.length >= 3) return seeded;
    return profile?.username ?? '';
  }, [user, profile]);

  const [username, setUsername] = useState(initial);
  const [check, setCheck] = useState<CheckState>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    capture('onboarding_started');
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!username) {
      setCheck('idle');
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setCheck('invalid');
      return;
    }
    setCheck('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const ok = await isUsernameAvailable(username, user!.id);
        setCheck(ok ? 'available' : 'taken');
      } catch {
        setCheck('error');
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, user]);

  const canContinue = check === 'available';

  function handleContinue() {
    if (!canContinue) return;
    capture('onboarding_question_answered', { tier: 1, question: 'username' });
    router.push({ pathname: '/(onboarding)/locality', params: { username } });
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="px-6 pt-4">
          <OnboardingProgressBar step={1} total={4} />
        </View>

        <View className="flex-1 px-6 pt-10">
          <Text className="text-3xl font-bold text-gray-900 mb-3">
            What should we call you?
          </Text>
          <Text className="text-gray-500 mb-8">
            This is your handle on the map. Pick something your friends will recognize.
          </Text>

          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base"
            value={username}
            onChangeText={(t) => setUsername(sanitize(t))}
            placeholder="your_handle"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={MAX_LEN}
          />

          <View className="mt-3 h-5 flex-row items-center">
            {check === 'checking' && (
              <>
                <ActivityIndicator size="small" color="#6B7280" />
                <Text className="ml-2 text-xs text-gray-500">Checking…</Text>
              </>
            )}
            {check === 'available' && (
              <Text className="text-xs text-emerald-600 font-medium">
                {username} is available
              </Text>
            )}
            {check === 'taken' && (
              <Text className="text-xs text-rose-600 font-medium">
                That handle is taken
              </Text>
            )}
            {check === 'invalid' && username.length > 0 && (
              <Text className="text-xs text-gray-500">
                3–24 characters: letters, numbers, underscores
              </Text>
            )}
            {check === 'error' && (
              <Text className="text-xs text-rose-600">Couldn't check — try again</Text>
            )}
          </View>
        </View>

        <View className="px-6 pb-8">
          <TouchableOpacity
            className={`rounded-xl py-4 items-center ${
              canContinue ? 'bg-indigo-500' : 'bg-gray-200'
            }`}
            onPress={handleContinue}
            disabled={!canContinue}
          >
            <Text
              className={`font-semibold text-base ${
                canContinue ? 'text-white' : 'text-gray-400'
              }`}
            >
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
