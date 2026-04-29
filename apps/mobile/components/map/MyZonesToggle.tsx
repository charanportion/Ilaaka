import { TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTokens } from '@/lib/useTokens';
import { shadows } from '@/lib/design-tokens';

type Props = {
  showOnlyMine: boolean;
  onToggle: () => void;
};

export function MyZonesToggle({ showOnlyMine, onToggle }: Props) {
  const { colors } = useTokens();
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.8}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 9999,
        backgroundColor: showOnlyMine ? colors.ctaBg : colors.surface,
        borderWidth: 1,
        borderColor: showOnlyMine ? colors.ctaBg : colors.border,
        ...shadows.whisper,
      }}
    >
      <Text
        variant="captionStrong"
        style={{ color: showOnlyMine ? colors.ctaFg : colors.ink }}
      >
        {showOnlyMine ? 'My zones' : 'All zones'}
      </Text>
    </TouchableOpacity>
  );
}
