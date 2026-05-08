import { useEffect } from 'react';
import { TextInput, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { typography, type TypographyVariant } from '@/lib/design-tokens';
import { useTokens } from '@/lib/useTokens';

const ATextInput = Animated.createAnimatedComponent(TextInput);

type Props = {
  value: number;
  /** ms from 0 → value. Defaults to 1100. */
  duration?: number;
  /** Decimal places. Defaults to 0. */
  decimals?: number;
  /** Suffix appended to the formatted number (e.g. " km"). */
  suffix?: string;
  /** Group thousands. Defaults to true. */
  group?: boolean;
  /** Typography variant from design tokens. */
  variant?: TypographyVariant;
  style?: StyleProp<TextStyle>;
};

/**
 * Number that ticks up from 0 to `value` on mount. Driven by Reanimated's
 * shared value so it runs on the UI thread — won't stutter under load.
 *
 * Implemented with a non-editable TextInput because Reanimated's
 * animatedProps text-update path only works on TextInput, not Text.
 * Visually identical, just made read-only.
 */
export function AnimatedNumber({
  value,
  duration = 1100,
  decimals = 0,
  suffix,
  group = true,
  variant = 'h1',
  style,
}: Props) {
  const { colors } = useTokens();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, progress]);

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const fixed = progress.value.toFixed(decimals);
    let display = fixed;
    if (group) {
      const [intPart, decPart] = fixed.split('.');
      const grouped = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      display = decPart != null ? `${grouped}.${decPart}` : grouped;
    }
    return { text: `${display}${suffix ?? ''}`, value: `${display}${suffix ?? ''}` } as never;
  });

  const t = typography[variant];

  return (
    <ATextInput
      underlineColorAndroid="transparent"
      editable={false}
      defaultValue={`0${suffix ?? ''}`}
      animatedProps={animatedProps}
      allowFontScaling={false}
      style={[
        {
          fontFamily: t.fontFamily,
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          letterSpacing: t.letterSpacing,
          color: colors.ink,
          padding: 0,
          textAlign: 'center',
        },
        style,
      ]}
    />
  );
}
