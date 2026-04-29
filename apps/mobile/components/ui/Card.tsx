import { View, type ViewProps, type ViewStyle, type StyleProp } from 'react-native';
import { useTokens } from '@/lib/useTokens';
import { radius, shadows } from '@/lib/design-tokens';

type Elevation = 'none' | 'whisper' | 'standard';
type Radius = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

type Props = Omit<ViewProps, 'style'> & {
  elevation?: Elevation;
  radius?: Radius;
  bordered?: boolean;
  surface?: 'surface' | 'surfaceAlt';
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  elevation = 'none',
  radius: r = 'lg',
  bordered = true,
  surface = 'surface',
  padding,
  style,
  children,
  ...rest
}: Props) {
  const { colors } = useTokens();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors[surface],
          borderRadius: radius[r],
          borderWidth: bordered ? 1 : 0,
          borderColor: colors.border,
          ...(elevation === 'whisper'  ? shadows.whisper  : null),
          ...(elevation === 'standard' ? shadows.standard : null),
        },
        padding != null ? { padding } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
