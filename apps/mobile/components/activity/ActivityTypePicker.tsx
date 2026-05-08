import { View, TouchableOpacity } from 'react-native';
import { Activity, Footprints, Bike, Mountain } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { useTokens } from '@/lib/useTokens';
import type { ActivityType } from '@/types/api';

type IconComponent = React.ComponentType<{ color: string; size: number }>;

const TYPES: { type: ActivityType; label: string; Icon: IconComponent }[] = [
  { type: 'run',   label: 'Run',   Icon: Activity   },
  { type: 'walk',  label: 'Walk',  Icon: Footprints },
  { type: 'cycle', label: 'Cycle', Icon: Bike       },
  { type: 'hike',  label: 'Hike',  Icon: Mountain   },
];

type Props = {
  selected: ActivityType;
  onChange: (type: ActivityType) => void;
};

export function ActivityTypePicker({ selected, onChange }: Props) {
  const { colors } = useTokens();
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {TYPES.map(({ type, label, Icon }) => {
        const active = selected === type;
        return (
          <TouchableOpacity
            key={type}
            onPress={() => onChange(type)}
            style={{
              flex: 1, alignItems: 'center',
              paddingVertical: 12,
              borderRadius: 16,
              borderWidth: 1,
              backgroundColor: active ? colors.ctaBg : colors.surface,
              borderColor:     active ? colors.ctaBg : colors.border,
            }}
          >
            <Icon color={active ? colors.ctaFg : colors.inkMuted} size={20} />
            <Text
              variant="tag"
              style={{ marginTop: 4, color: active ? colors.ctaFg : colors.inkMuted }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
