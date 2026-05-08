import { useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { X, ChevronRight } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/brand/Eyebrow';
import { useTokens } from '@/lib/useTokens';

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
  const { colors } = useTokens();

  /* Spring entrance — re-fires whenever a different zone is tapped, so the
     card "bounces" between selections and feels responsive. */
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = 0;
    enter.value = withSpring(1, { damping: 16, stiffness: 220 });
  }, [enter, owner_id, captured_at]);

  const enterStyle = useAnimatedStyle(() => {
    const translateY = interpolate(enter.value, [0, 1], [40, 0]);
    return {
      opacity: withTiming(enter.value, { duration: 160, easing: Easing.out(Easing.quad) }),
      transform: [{ translateY }],
    };
  });

  return (
    <Animated.View style={enterStyle}>
    <Card padding={16} radius="xxl" elevation="standard" style={{ marginHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <Eyebrow>Held by</Eyebrow>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={{ marginLeft: 8, padding: 2 }}>
          <X color={colors.inkSubtle} size={18} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => onViewProfile(owner_id)}
        activeOpacity={0.7}
        className="flex-row items-center"
      >
        <View className="mr-3">
          <Avatar
            size={44}
            displayName={owner_display_name || owner_username || '?'}
            color={color}
            avatarUrl={owner_avatar_url}
            intent="territory"
          />
        </View>
        <View className="flex-1">
          <Text variant="h3" tone="strong" numberOfLines={1}>
            {is_own ? 'Your zone' : owner_display_name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            @{owner_username} · captured {relativeTime(captured_at)}
          </Text>
        </View>
        {!is_own && <ChevronRight size={18} color={colors.inkSubtle} />}
      </TouchableOpacity>

      {!is_own && (
        <Button
          label="View profile"
          variant="secondary"
          size="md"
          fullWidth
          onPress={() => onViewProfile(owner_id)}
          style={{ marginTop: 12 }}
        />
      )}
    </Card>
    </Animated.View>
  );
}
