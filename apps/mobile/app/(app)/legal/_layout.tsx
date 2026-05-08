import { Stack } from 'expo-router';
import { useTokens } from '@/lib/useTokens';
import { typography } from '@/lib/design-tokens';

export default function LegalLayout() {
  const { colors } = useTokens();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontFamily: typography.bodyStrong.fontFamily, color: colors.ink },
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="about"   options={{ title: 'About'   }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
      <Stack.Screen name="terms"   options={{ title: 'Terms'   }} />
    </Stack>
  );
}
