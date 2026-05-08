import { TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Locate, Navigation } from 'lucide-react-native';
import { useTokens } from '@/lib/useTokens';
import { shadows } from '@/lib/design-tokens';

type Props = {
  mode: 'recenter' | 'compass';
  bearing: number;
  onPress: () => void;
  style?: ViewStyle;
};

export function MapRecenterButton({ mode, bearing, onPress, style }: Props) {
  const { colors } = useTokens();
  const recenterIcon = colors.ink;
  const compassIcon  = colors.accent;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={mode === 'recenter' ? 'Center map on my location' : 'Reset map to north'}
      style={[
        {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadows.whisper,
        },
        style,
      ]}
    >
      {mode === 'recenter' ? (
        <Locate size={22} color={recenterIcon} strokeWidth={2.25} />
      ) : (
        <View style={{ transform: [{ rotate: `${-bearing}deg` }] }}>
          <Navigation size={22} color={compassIcon} strokeWidth={2.25} fill={compassIcon} />
        </View>
      )}
    </TouchableOpacity>
  );
}
