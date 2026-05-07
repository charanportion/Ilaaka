import Svg, { Polygon } from 'react-native-svg';
import { View } from 'react-native';
import { useTokens } from '@/lib/useTokens';

type Props = {
  size?: number;
  color?: string;
  /** Outline-only variant — useful when sitting on top of a solid surface. */
  outline?: boolean;
};

/**
 * Pointy-top hex bullet glyph. Brand decoration — the same shape used for
 * the ilaaka wordmark on the landing. Defaults to paper-cream so it reads
 * as monochrome chrome; pass `color` to use a territory hue when next to
 * an actual territory representation.
 */
export function HexBullet({ size = 12, color, outline = false }: Props) {
  const { colors } = useTokens();
  const fill = color ?? colors.ink;

  /* Pointy-top hex inscribed in a 60×52 viewBox. */
  return (
    <View style={{ width: size, height: size * (52 / 60) }}>
      <Svg viewBox="0 0 60 52" width="100%" height="100%">
        <Polygon
          points="30,1 58,16 58,38 30,52 2,38 2,16"
          fill={outline ? 'transparent' : fill}
          stroke={outline ? fill : 'none'}
          strokeWidth={outline ? 4 : 0}
        />
      </Svg>
    </View>
  );
}
