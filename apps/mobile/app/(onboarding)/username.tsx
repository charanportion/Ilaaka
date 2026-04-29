import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth-store';
import { isUsernameAvailable } from '@/lib/users';
import { capture } from '@/lib/analytics';
import { OnboardingProgressBar } from '@/components/onboarding/ProgressBar';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useTokens } from '@/lib/useTokens';
import { typography } from '@/lib/design-tokens';

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
  const { colors } = useTokens();

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
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="px-6 pt-4">
          <OnboardingProgressBar step={1} total={4} />
        </View>

        <View className="flex-1 px-6 pt-10">
          <Text variant="h1" tone="strong" style={{ marginBottom: 12 }}>
            What should we call you?
          </Text>
          <Text variant="bodyLg" tone="muted" style={{ marginBottom: 32 }}>
            This is your handle on the map. Pick something your friends will recognize.
          </Text>

          <TextInput
            value={username}
            onChangeText={(t) => setUsername(sanitize(t))}
            placeholder="your_handle"
            placeholderTextColor={colors.inkSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={MAX_LEN}
            style={{
              borderWidth: 1,
              borderColor: colors.borderInput,
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontFamily: typography.body.fontFamily,
              fontSize: typography.body.fontSize,
              color: colors.ink,
              backgroundColor: colors.surface,
            }}
          />

          <View className="mt-3 h-5 flex-row items-center">
            {check === 'checking' && (
              <>
                <ActivityIndicator size="small" color={colors.inkMuted} />
                <Text variant="tag" tone="muted" style={{ marginLeft: 8 }}>Checking…</Text>
              </>
            )}
            {check === 'available' && (
              <Text variant="tag" tone="success">{username} is available</Text>
            )}
            {check === 'taken' && (
              <Text variant="tag" tone="danger">That handle is taken</Text>
            )}
            {check === 'invalid' && username.length > 0 && (
              <Text variant="tag" tone="muted">3–24 characters: letters, numbers, underscores</Text>
            )}
            {check === 'error' && (
              <Text variant="tag" tone="danger">Couldn&apos;t check — try again</Text>
            )}
          </View>
        </View>

        <View className="px-6 pb-8">
          <Button
            label="Continue"
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canContinue}
            onPress={handleContinue}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
