import { View, Text, TouchableOpacity } from 'react-native';
import { X, ChevronRight } from 'lucide-react-native';
import { Avatar } from '@/components/ui/Avatar';

type ZoneFeature = {
  color: string;
  owner_id: string;
  owner_username: string;
  owner_display_name: string;
  owner_avatar_url: string | null;
  captured_at: string;
  is_own: boolean;
};

type Props = {
  properties: ZoneFeature;
  onClose: () => void;
  onViewProfile: (ownerId: string) => void;
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

export function ZoneInfoCard({ properties, onClose, onViewProfile }: Props) {
  const {
    color, owner_id, owner_username, owner_display_name, owner_avatar_url,
    captured_at, is_own,
  } = properties;

  return (
    <View className="bg-white rounded-3xl mx-4 p-4 shadow-lg">
      <View className="flex-row items-start">
        <TouchableOpacity
          onPress={() => onViewProfile(owner_id)}
          activeOpacity={0.7}
          className="flex-row items-center flex-1"
        >
          <View className="mr-3">
            <Avatar
              size={44}
              displayName={owner_display_name || owner_username || '?'}
              color={color}
              avatarUrl={owner_avatar_url}
            />
          </View>
          <View className="flex-1">
            <Text className="font-bold text-gray-900 text-base" numberOfLines={1}>
              {is_own ? 'Your zone' : owner_display_name}
            </Text>
            <Text className="text-gray-500 text-xs" numberOfLines={1}>
              @{owner_username} · captured {relativeTime(captured_at)}
            </Text>
          </View>
          {!is_own && <ChevronRight size={18} color="#9CA3AF" />}
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} hitSlop={12} className="ml-2 p-1">
          <X color="#9CA3AF" size={20} />
        </TouchableOpacity>
      </View>

      {!is_own && (
        <TouchableOpacity
          onPress={() => onViewProfile(owner_id)}
          className="mt-3 bg-indigo-50 rounded-xl py-2.5 items-center"
          activeOpacity={0.8}
        >
          <Text className="text-indigo-600 text-sm font-semibold">View profile</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
