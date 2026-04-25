import { View, Text, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';

type ZoneFeature = {
  color: string;
  owner_username: string;
  captured_at: string;
  is_own: boolean;
};

type Props = {
  properties: ZoneFeature;
  onClose: () => void;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ZoneInfoCard({ properties, onClose }: Props) {
  const { color, owner_username, captured_at, is_own } = properties;

  return (
    <View className="bg-white rounded-3xl mx-4 p-5 shadow-lg">
      <View className="flex-row items-center mb-2">
        <View className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: color }} />
        <Text className="font-bold text-gray-900 text-base flex-1">
          {is_own ? 'Your zone' : `@${owner_username}`}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <X color="#9CA3AF" size={20} />
        </TouchableOpacity>
      </View>
      <Text className="text-gray-500 text-sm">Captured {relativeTime(captured_at)}</Text>
      {!is_own && (
        <Text className="text-indigo-500 text-xs mt-1">
          Record a route here to capture this zone
        </Text>
      )}
    </View>
  );
}
