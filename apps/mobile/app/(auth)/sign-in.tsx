import { useState } from 'react';
import {
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';
import { signInWithEmail, signInWithGoogleWeb } from '@/lib/auth';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEmailSignIn() {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (e: unknown) {
      Alert.alert('Sign in failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      await signInWithGoogleWeb();
    } catch (e: unknown) {
      Alert.alert('Google sign in failed', e instanceof Error ? e.message : 'Unknown error');
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
        <Text variant="h1" tone="strong" align="center" style={{ marginBottom: 8 }}>Ilaaka</Text>
        <Text variant="bodyLg" tone="muted" align="center" style={{ marginBottom: 40 }}>
          Apna Ilaaka. Apni Fitness.
        </Text>

        <Input
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
          containerStyle={{ marginBottom: 12 }}
        />
        <Input
          label="Password"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          containerStyle={{ marginBottom: 20 }}
        />

        <Button
          label="Sign in"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          onPress={handleEmailSignIn}
          style={{ marginBottom: 12 }}
        />

        <Button
          label="Sign in with Google"
          variant="secondary"
          size="lg"
          fullWidth
          disabled={loading}
          onPress={handleGoogleSignIn}
          style={{ marginBottom: 24 }}
        />

        <Link href="/(auth)/sign-up" asChild>
          <Text variant="caption" tone="muted" align="center">
            No account? <Text variant="captionStrong" tone="link">Sign up</Text>
          </Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
