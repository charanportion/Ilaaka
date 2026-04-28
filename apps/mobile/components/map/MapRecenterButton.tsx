import { TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Locate, Navigation } from 'lucide-react-native';

type Props = {
  mode: 'recenter' | 'compass';
  bearing: number;
  onPress: () => void;
  style?: ViewStyle;
};

export function MapRecenterButton({ mode, bearing, onPress, style }: Props) {
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
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 4,
          elevation: 4,
        },
        style,
      ]}
    >
      {mode === 'recenter' ? (
        <Locate size={22} color="#374151" strokeWidth={2.25} />
      ) : (
        <View style={{ transform: [{ rotate: `${-bearing}deg` }] }}>
          <Navigation size={22} color="#6366F1" strokeWidth={2.25} fill="#6366F1" />
        </View>
      )}
    </TouchableOpacity>
  );
}
