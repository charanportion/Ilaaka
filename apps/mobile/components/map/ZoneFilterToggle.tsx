import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTokens } from '@/lib/useTokens';
import { shadows } from '@/lib/design-tokens';
import type { ZoneFilter } from '@/types/api';

type Props = {
  value: ZoneFilter;
  onChange: (next: ZoneFilter) => void;
};

const SEGMENTS: { label: string; value: ZoneFilter }[] = [
  { label: 'All',     value: 'all'     },
  { label: 'Mine',    value: 'mine'    },
  { label: 'Friends', value: 'friends' },
];

export function ZoneFilterToggle({ value, onChange }: Props) {
  const { colors } = useTokens();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 9999,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.whisper,
      }}
    >
      {SEGMENTS.map((seg, i) => {
        const active = value === seg.value;
        return (
          <TouchableOpacity
            key={seg.value}
            onPress={() => onChange(seg.value)}
            activeOpacity={0.8}
            style={{
              paddingHorizontal: 16, paddingVertical: 8,
              backgroundColor: active ? colors.ctaBg : colors.surface,
              borderLeftWidth: i > 0 ? 1 : 0,
              borderLeftColor: colors.border,
            }}
          >
            <Text
              variant="captionStrong"
              style={{ color: active ? colors.ctaFg : colors.ink }}
            >
              {seg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
