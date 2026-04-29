import { ActivityIndicator, Pressable, Text as RNText, View, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import { useTokens } from '@/lib/useTokens';
import { radius, typography } from '@/lib/design-tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
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
  style,
  ...rest
}: Props) {
  const { colors, scheme } = useTokens();

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
    <View
      style={[
        {
          height: heights[size],
          borderRadius: radius.pill,
          backgroundColor: palette.bg,
          overflow: 'hidden',
          opacity: disabled ? 0.5 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      <Pressable
        {...rest}
        disabled={disabled || loading}
        style={({ pressed }) => ({
          flex: 1,
          paddingHorizontal: padX[size],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.75 : 1,
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
    </View>
  );
}
