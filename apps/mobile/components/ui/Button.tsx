import { ActivityIndicator, Pressable, Text as RNText, View, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useTokens } from '@/lib/useTokens';
import { radius, typography } from '@/lib/design-tokens';

const AView = Animated.createAnimatedComponent(View);

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

type Props = Omit<PressableProps, 'style' | 'children' | 'onPressIn' | 'onPressOut'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  /** Disable the haptic blip on press. Defaults to on for primary/destructive. */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth,
  disabled,
  haptic,
  onPress,
  style,
  ...rest
}: Props) {
  const { colors, scheme } = useTokens();
  const pressScale = useSharedValue(1);

  /* Haptics default-on for the high-stakes variants. Secondary/ghost are
     usually navigational ("Back", "Cancel") — silent feels right. */
  const hapticOn = haptic ?? (variant === 'primary' || variant === 'destructive');

  const pressInStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  function handlePressIn() {
    pressScale.value = withTiming(0.96, { duration: 90, easing: Easing.out(Easing.quad) });
  }
  function handlePressOut() {
    pressScale.value = withSpring(1, { damping: 14, stiffness: 320 });
  }
  function handlePress(e: Parameters<NonNullable<PressableProps['onPress']>>[0]) {
    if (hapticOn) {
      const style =
        variant === 'destructive'
          ? Haptics.ImpactFeedbackStyle.Heavy
          : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(style).catch(() => {});
    }
    onPress?.(e);
  }

  const heights: Record<Size, number> = { sm: 36, md: 44, lg: 52 };
  const padX:    Record<Size, number> = { sm: 14, md: 18, lg: 24 };
  const fontSize: Record<Size, number> = { sm: 13, md: 15, lg: 17 };

  // Secondary fill: translucent monochrome — distinguishes from the page surface
  // without breaking the strict black/white system.
  const softFill = scheme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';

  const palette =
    variant === 'primary' ? {
      bg: colors.ctaBg, fg: colors.ctaFg,
    } :
    variant === 'secondary' ? {
      bg: softFill, fg: colors.ink,
    } :
    variant === 'destructive' ? {
      bg: colors.danger, fg: '#ffffff',
    } : /* ghost */ {
      bg: 'transparent', fg: colors.ink,
    };

  // The wrapping View carries the visual styling so the background always
  // renders reliably (function-form Pressable styles have flaky first-render
  // behavior on iOS). The inner Pressable fills it and handles touches.
  return (
    <AView
      style={[
        {
          height: heights[size],
          borderRadius: radius.pill,
          backgroundColor: palette.bg,
          overflow: 'hidden',
          opacity: disabled ? 0.5 : 1,
          width: fullWidth ? '100%' : undefined,
          /* Centering anchored on the outer View (not just the inner
             Pressable) so the label sits centered even when a parent
             gives the button `flex: 1` in a row. Belt + braces with the
             inner Pressable's own justify/align below. */
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressInStyle,
        style,
      ]}
    >
      <Pressable
        {...rest}
        disabled={disabled || loading}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={({ pressed }) => ({
          flex: 1,
          paddingHorizontal: padX[size],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {loading ? (
          <ActivityIndicator color={palette.fg} size="small" />
        ) : (
          <>
            {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}
            <RNText
              numberOfLines={1}
              allowFontScaling={false}
              style={{
                fontFamily: typography.bodyStrong.fontFamily,
                fontSize: fontSize[size],
                color: palette.fg,
                letterSpacing: -0.1,
                textAlign: 'center',
                textAlignVertical: 'center',
                includeFontPadding: false,
              }}
            >
              {label}
            </RNText>
            {rightIcon ? <View style={{ marginLeft: 8 }}>{rightIcon}</View> : null}
          </>
        )}
      </Pressable>
    </AView>
  );
}
