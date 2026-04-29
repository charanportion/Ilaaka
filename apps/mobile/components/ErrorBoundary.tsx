import { Component, type ReactNode } from 'react';
import { View, Pressable } from 'react-native';
import * as Updates from 'expo-updates';
import { Text } from '@/components/ui/Text';
import { typography } from '@/lib/design-tokens';

type Props = { children: ReactNode };
type State = { error: Error | null };

// Top-level error boundary so a single bad render doesn't kill the entire app.
// Reports to Sentry (lazy-loaded so Expo Go on new arch doesn't crash on the
// native TurboModule lookup) and gives the user a "Restart" button.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/react-native');
      Sentry.captureException?.(error, {
        contexts: { react: { componentStack: info.componentStack ?? '' } },
      });
    } catch {
      // Sentry unavailable (Expo Go) — fall through.
    }
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, info.componentStack ?? '');
    }
  }

  reset = () => this.setState({ error: null });

  reload = async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      // expo-updates not available in Expo Go; fall back to clearing the error
      // and hoping a re-render works.
      this.reset();
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={{
        flex: 1,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <Text variant="h2" tone="inverse" align="center" style={{ marginBottom: 8 }}>
          Something went wrong
        </Text>
        <Text variant="body" tone="inverse" align="center" style={{ opacity: 0.7, marginBottom: 24 }}>
          The app hit an unexpected error. Try restarting — your activity is safe.
        </Text>

        <Pressable
          onPress={this.reload}
          style={({ pressed }) => ({
            backgroundColor: '#ffffff',
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 999,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Text style={{
            fontFamily: typography.bodyStrong.fontFamily,
            color: '#000000',
            fontSize: 16,
          }}>
            Restart
          </Text>
        </Pressable>

        {__DEV__ ? (
          <Text variant="caption" tone="inverse" align="center" style={{ opacity: 0.5, marginTop: 16, paddingHorizontal: 12 }}>
            {this.state.error.message}
          </Text>
        ) : null}
      </View>
    );
  }
}
