import { ActivityIndicator, View, type ViewStyle, type StyleProp } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useTokens } from '@/lib/useTokens';

type Props = {
  variant: 'loading' | 'error' | 'empty';
  title?: string;
  message?: string;
  retry?: () => void;
  retryLabel?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

// Single source of truth for non-content screen states. Use anywhere a list
// or detail screen needs to communicate "loading", "fetch failed", or "empty".
//
// Usage:
//   if (loading) return <ScreenState variant="loading" />;
//   if (error)   return <ScreenState variant="error" retry={load} />;
//   if (!items.length) return <ScreenState variant="empty" title="No friends yet" />;
export function ScreenState({
  variant,
  title,
  message,
  retry,
  retryLabel = 'Try again',
  icon,
  style,
}: Props) {
  const { colors } = useTokens();

  if (variant === 'loading') {
    return (
      <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, style]}>
        <ActivityIndicator color={colors.ink} />
        {title ? (
          <Text tone="muted" align="center" style={{ marginTop: 12 }}>{title}</Text>
        ) : null}
      </View>
    );
  }

  const fallbackTitle = variant === 'error' ? 'Couldn’t load that' : 'Nothing here yet';
  const fallbackMsg =
    variant === 'error'
      ? 'Check your connection and try again.'
      : '';

  return (
    <View style={[{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    }, style]}>
      {icon ? <View style={{ marginBottom: 12 }}>{icon}</View> : null}
      <Text variant="h3" align="center" style={{ marginBottom: 4 }}>
        {title ?? fallbackTitle}
      </Text>
      {(message ?? fallbackMsg) ? (
        <Text tone="muted" align="center" style={{ marginBottom: 16 }}>
          {message ?? fallbackMsg}
        </Text>
      ) : null}
      {retry ? (
        <Button label={retryLabel} variant="primary" size="md" onPress={retry} />
      ) : null}
    </View>
  );
}
