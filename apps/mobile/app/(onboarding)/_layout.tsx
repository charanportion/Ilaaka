import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="username" />
      <Stack.Screen name="locality" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="permissions" />
    </Stack>
  );
}
