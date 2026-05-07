import { useMemo, useState } from 'react';
import {
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { signUpWithEmail } from '@/lib/auth';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/brand/Eyebrow';
import { ScribbleSticker } from '@/components/brand/ScribbleSticker';
import { useTokens } from '@/lib/useTokens';

// Reasonable RFC-5322 simplification — full RFC is unverifiable in practice.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function passwordStrength(p: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (p.length < 8) return { score: 0, label: 'Too short' };
  let score = 1;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/\d/.test(p) || /[^A-Za-z0-9]/.test(p)) score++;
  return {
    score: Math.min(3, score) as 0 | 1 | 2 | 3,
    label: score === 1 ? 'Weak' : score === 2 ? 'OK' : 'Strong',
  };
}

export default function SignUpScreen() {
  const router = useRouter();
  const { colors } = useTokens();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const emailValid = email.trim().length === 0 || EMAIL_REGEX.test(email.trim());
  const strength = useMemo(() => passwordStrength(password), [password]);
  const canSubmit = !loading
    && email.trim().length > 0
    && EMAIL_REGEX.test(email.trim())
    && password.length >= 8;

  async function handleSignUp() {
    if (!email || !password) {
      Alert.alert('Missing details', 'Enter your email and a password.');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      Alert.alert('Check your email', 'That doesn’t look like a valid email address.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password);
      Alert.alert(
        'Check your email',
        `We sent a verification link to ${email.trim()}. Confirm it, then sign in.`,
        [{ text: 'OK', onPress: () => router.replace('/(auth)/sign-in') }],
      );
    } catch (e: unknown) {
      Alert.alert('Sign up failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-bg"
    >
      <View className="flex-1 justify-center px-6">
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <Eyebrow style={{ marginBottom: 18, justifyContent: 'center' }}>
            New walker · Hyderabad
          </Eyebrow>
          <ScribbleSticker inset={{ x: 18, y: 6 }} style={{ alignSelf: 'center' }}>
            <Text
              variant="displayWonk"
              tone="inverse"
              style={{ fontSize: 56, lineHeight: 60, paddingHorizontal: 4 }}
            >
              ilaaka
            </Text>
          </ScribbleSticker>
          <Text
            variant="bodyLg"
            tone="muted"
            align="center"
            style={{ marginTop: 22 }}
          >
            Claim your neighbourhood.
          </Text>
        </View>

        <Input
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!loading}
          containerStyle={{ marginBottom: 4 }}
        />
        {!emailValid ? (
          <Text variant="caption" tone="danger" style={{ marginBottom: 8, marginLeft: 2 }}>
            Enter a valid email address.
          </Text>
        ) : (
          <View style={{ marginBottom: 8 }} />
        )}

        <Input
          label="Password"
          placeholder="At least 8 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          containerStyle={{ marginBottom: 4 }}
        />
        {password.length > 0 ? (
          <View style={{ marginBottom: 20, marginLeft: 2 }}>
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  backgroundColor:
                    i < strength.score
                      ? (strength.score === 1 ? colors.danger : strength.score === 2 ? colors.warning : colors.success)
                      : colors.borderInput,
                }} />
              ))}
            </View>
            <Text variant="tag" tone="muted">{strength.label}</Text>
          </View>
        ) : (
          <View style={{ marginBottom: 20 }} />
        )}

        <Button
          label="Create account"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={!canSubmit}
          onPress={handleSignUp}
          style={{ marginBottom: 24 }}
        />

        <Link href="/(auth)/sign-in" asChild>
          <Text variant="caption" tone="muted" align="center">
            Already have an account? <Text variant="captionStrong" tone="link">Sign in</Text>
          </Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
