import { View, Text, TouchableOpacity } from 'react-native';
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
  return (
    <View className="flex-row bg-white rounded-full shadow-sm overflow-hidden">
      {SEGMENTS.map((seg, i) => {
        const active = value === seg.value;
        return (
          <TouchableOpacity
            key={seg.value}
            onPress={() => onChange(seg.value)}
            activeOpacity={0.8}
            className={[
              'px-4 py-2',
              active ? 'bg-indigo-500' : 'bg-white',
              i > 0 ? 'border-l border-gray-100' : '',
            ].join(' ')}
          >
            <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-700'}`}>
              {seg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
