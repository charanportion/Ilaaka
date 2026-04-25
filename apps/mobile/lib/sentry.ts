import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function initSentry() {
  if (isExpoGo) return; // Expo Go has no native Sentry TurboModule — skip entirely
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  // Lazy require keeps the top-level module graph free of native references,
  // which is what causes the TurboModule crash in Expo Go on new arch.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require('@sentry/react-native');
  Sentry.init({ dsn, tracesSampleRate: 0.2 });
}
