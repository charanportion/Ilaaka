import { View, type ViewStyle, type StyleProp } from 'react-native';
import { Text, type TextTone } from '@/components/ui/Text';
import { HexBullet } from './HexBullet';

type Props = {
  children: React.ReactNode;
  /** Show a leading hex bullet. Off by default for a cleaner inline look. */
  bullet?: boolean;
  tone?: TextTone;
  style?: StyleProp<ViewStyle>;
};

/**
 * Editorial section anchor. Mono uppercase tracked label, optionally
 * preceded by a hex bullet. Mirrors the landing's `.eyebrow` class.
 *
 * Usage: <Eyebrow>Held by</Eyebrow>  →  ▢ HELD BY
 */
export function Eyebrow({ children, bullet = false, tone, style }: Props) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 8 },
        style,
      ]}
    >
      {bullet ? <HexBullet size={9} /> : null}
      <Text variant="eyebrow" tone={tone}>
        {children}
      </Text>
    </View>
  );
}
