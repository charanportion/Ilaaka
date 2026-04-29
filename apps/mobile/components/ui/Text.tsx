import { Text as RNText, type TextProps as RNTextProps, type TextStyle, type StyleProp } from 'react-native';
import { typography, type TypographyVariant } from '@/lib/design-tokens';
import { useTokens } from '@/lib/useTokens';

export type TextTone = 'default' | 'strong' | 'muted' | 'subtle' | 'link' | 'danger' | 'success' | 'warning' | 'inverse';

type Props = Omit<RNTextProps, 'style'> & {
  variant?: TypographyVariant;
  tone?: TextTone;
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<TextStyle>;
};

export function Text({
  variant = 'body',
  tone = 'default',
  align,
  style,
  children,
  ...rest
}: Props) {
  const { colors } = useTokens();
  const t = typography[variant];

  const color =
    tone === 'strong'  ? colors.inkStrong  :
    tone === 'muted'   ? colors.inkMuted   :
    tone === 'subtle'  ? colors.inkSubtle  :
    tone === 'link'    ? colors.link       :
    tone === 'danger'  ? colors.danger     :
    tone === 'success' ? colors.success    :
    tone === 'warning' ? colors.warning    :
    tone === 'inverse' ? colors.ctaFg      :
                          colors.ink;

  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: t.fontFamily,
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          letterSpacing: t.letterSpacing,
          color,
        },
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
