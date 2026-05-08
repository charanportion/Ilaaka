import { View, type ViewStyle, type StyleProp } from 'react-native';
import { useTokens } from '@/lib/useTokens';

type Props = {
  children: React.ReactNode;
  /** Optional override for the sticker fill. Defaults to ctaBg, which
      auto-inverts per theme so the sticker always contrasts the page. */
  fill?: string;
  /** Padding around the wrapped content (px). Tunes how much of the
      sticker pokes out from behind the text. */
  inset?: { x?: number; y?: number };
  style?: StyleProp<ViewStyle>;
};

/**
 * Paper-tape "sticker" highlight that sits behind a brand-name moment
 * (e.g. the ilaaka wordmark). Slight skew + irregular border-radius +
 * drop shadow give it a hand-applied, off-center quality. Mirrors the
 * landing's `.scribble::after` styling.
 *
 * Use sparingly — strict 3-surface budget across the app (splash, sign-in
 * wordmark, profile header). Anywhere else dilutes the signal.
 *
 * Set the wrapped Text's `tone` to `inverse` so it reads against the
 * sticker fill in both themes.
 */
export function ScribbleSticker({ children, fill, inset, style }: Props) {
  const { colors } = useTokens();
  const padX = inset?.x ?? 14;
  const padY = inset?.y ?? 4;
  return (
    <View style={[{ alignSelf: 'flex-start', position: 'relative' }, style]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -padX,
          right: -padX,
          top: padY,
          bottom: padY,
          backgroundColor: fill ?? colors.ctaBg,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 12,
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 10,
          transform: [{ skewX: '-3deg' }],
          shadowColor: '#000',
          shadowOpacity: 0.55,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      />
      <View style={{ position: 'relative' }}>{children}</View>
    </View>
  );
}
