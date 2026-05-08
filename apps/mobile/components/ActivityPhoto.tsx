import { useState } from 'react';
import { View, Image, type ImageStyle, type StyleProp } from 'react-native';
import { ImageOff } from 'lucide-react-native';
import { useTokens } from '@/lib/useTokens';

type Props = {
  uri: string;
  size: number;
  style?: StyleProp<ImageStyle>;
  borderRadius?: number;
};

// Activity photo with a graceful failure state. Replaces bare <Image> usages
// in feed cards + detail screens so a dead URL renders a placeholder instead
// of a blank coloured rectangle.
export function ActivityPhoto({ uri, size, style, borderRadius = 16 }: Props) {
  const [failed, setFailed] = useState(false);
  const { colors } = useTokens();

  if (failed) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          },
          style as object,
        ]}
      >
        <ImageOff size={Math.min(28, size * 0.18)} color={colors.inkSubtle} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={[{ width: size, height: size, borderRadius, backgroundColor: colors.surfaceAlt }, style]}
    />
  );
}
