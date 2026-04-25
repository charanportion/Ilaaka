import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';
import { signInWithEmail, signInWithGoogleWeb } from '@/lib/auth';

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
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-center mb-2 text-brand">Ilaaka</Text>
        <Text className="text-center text-gray-500 mb-10">Apna Ilaaka. Apni Fitness.</Text>

        <TextInput
          className="border border-gray-300 rounded-xl px-4 py-3 mb-3 text-base"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
        <TextInput
          className="border border-gray-300 rounded-xl px-4 py-3 mb-5 text-base"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          className="bg-brand rounded-xl py-4 mb-3 items-center"
          onPress={handleEmailSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Sign in</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="border border-gray-300 rounded-xl py-4 mb-6 items-center"
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          <Text className="text-gray-700 font-semibold text-base">Sign in with Google</Text>
        </TouchableOpacity>

        <Link href="/(auth)/sign-up" asChild>
          <TouchableOpacity className="items-center">
            <Text className="text-gray-500">
              No account? <Text className="text-brand font-semibold">Sign up</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
