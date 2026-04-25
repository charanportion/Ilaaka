import { TouchableOpacity, Text } from 'react-native';

type Props = {
  showOnlyMine: boolean;
  onToggle: () => void;
};

export function MyZonesToggle({ showOnlyMine, onToggle }: Props) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      className={`px-4 py-2 rounded-full shadow-sm ${showOnlyMine ? 'bg-indigo-500' : 'bg-white'}`}
      activeOpacity={0.8}
    >
      <Text className={`text-sm font-semibold ${showOnlyMine ? 'text-white' : 'text-gray-700'}`}>
        {showOnlyMine ? 'My zones' : 'All zones'}
      </Text>
    </TouchableOpacity>
  );
}
