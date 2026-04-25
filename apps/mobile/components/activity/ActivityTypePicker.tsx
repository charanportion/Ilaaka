import { View, Text, TouchableOpacity } from 'react-native';
import { Activity, Footprints, Bike, Mountain } from 'lucide-react-native';
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
  return (
    <View className="flex-row gap-3">
      {TYPES.map(({ type, label, Icon }) => {
        const active = selected === type;
        return (
          <TouchableOpacity
            key={type}
            onPress={() => onChange(type)}
            className={`flex-1 items-center py-3 rounded-2xl border ${
              active ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-gray-200'
            }`}
          >
            <Icon color={active ? '#fff' : '#6B7280'} size={20} />
            <Text
              className={`text-xs mt-1 font-semibold ${
                active ? 'text-white' : 'text-gray-500'
              }`}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
