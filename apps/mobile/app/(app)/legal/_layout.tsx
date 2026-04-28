import { Stack } from 'expo-router';

export default function LegalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontWeight: '600' },
        headerTintColor: '#111827',
        headerStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen name="about"   options={{ title: 'About'   }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
      <Stack.Screen name="terms"   options={{ title: 'Terms'   }} />
    </Stack>
  );
}
