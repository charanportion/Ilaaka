import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  Image,
  Share,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Heart,
  MessageCircle,
  Share2,
  PersonStanding,
  Bike,
  Mountain,
  Activity as ActivityIconBase,
  Lock,
  Users,
} from 'lucide-react-native';
import { Avatar } from '@/components/ui/Avatar';
import { StaticActivityMap } from '@/components/feed/StaticActivityMap';
import { toggleActivityLike, activityPhotoUrl } from '@/lib/activities';
import { capture } from '@/lib/analytics';
import { useAuthStore } from '@/stores/auth-store';
import type { ActivityType, FeedItem } from '@/types/api';

const SHARE_BASE_URL = 'https://ilaaka.app/activity';

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

function formatArea(m2: number): string {
  if (m2 < 10_000) return `${m2.toLocaleString()} m²`;
  return `${(m2 / 10_000).toFixed(2)} ha`;
}

function formatPace(distanceM: number, durationS: number): string {
  if (distanceM < 100 || durationS < 1) return '--:--';
  const minPerKm = durationS / 60 / (distanceM / 1000);
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm % 1) * 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins} min ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function autoTitle(type: ActivityType, startedAt: string): string {
  const verb =
    type === 'run'   ? 'Run'  :
    type === 'walk'  ? 'Walk' :
    type === 'cycle' ? 'Ride' :
                       'Hike';
  const h = new Date(startedAt).getHours();
  const tod = h < 5 ? 'Late night' :
              h < 12 ? 'Morning'    :
              h < 17 ? 'Afternoon'  :
              h < 21 ? 'Evening'    : 'Night';
  return `${tod} ${verb}`;
}

function TypeIcon({ type, size = 16 }: { type: ActivityType; size?: number }) {
  const color = '#6366F1';
  if (type === 'cycle') return <Bike      size={size} color={color} />;
  if (type === 'hike')  return <Mountain  size={size} color={color} />;
  if (type === 'run')   return <ActivityIconBase size={size} color={color} />;
  return <PersonStanding size={size} color={color} />;
}

function VisibilityBadge({ value }: { value: FeedItem['visibility'] }) {
  if (value === 'public') return null;
  return (
    <View className="flex-row items-center bg-gray-100 rounded-full px-2 py-0.5 ml-2">
      {value === 'private' ? (
        <Lock size={10} color="#6B7280" />
      ) : (
        <Users size={10} color="#6B7280" />
      )}
      <Text className="text-[10px] text-gray-500 ml-1 font-medium">
        {value === 'private' ? 'Only you' : 'Followers'}
      </Text>
    </View>
  );
}

type Props = { item: FeedItem };

export function ActivityCard({ item }: Props) {
  const router = useRouter();
  const myId = useAuthStore((s) => s.user?.id);
  const isOwner = myId === item.user_id;

  const [liked,    setLiked]    = useState(item.has_liked);
  const [likeCnt,  setLikeCnt]  = useState(item.like_count);
  const [busy,     setBusy]     = useState(false);

  async function onToggleLike() {
    if (busy) return;
    // Optimistic update
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCnt((c) => c + (nextLiked ? 1 : -1));
    setBusy(true);
    try {
      const res = await toggleActivityLike(item.activity_id);
      setLiked(res.liked);
      setLikeCnt(res.likeCount);
      capture('activity_liked', { activity_id: item.activity_id, liked: res.liked });
    } catch {
      // Revert on failure
      setLiked(!nextLiked);
      setLikeCnt((c) => c + (nextLiked ? -1 : 1));
    } finally {
      setBusy(false);
    }
  }

  async function onShare() {
    try {
      await Share.share({
        message: `${item.display_name} on Ilaaka — ${item.title ?? autoTitle(item.type, item.started_at)} (${formatDistance(item.distance_m)})`,
        url:     `${SHARE_BASE_URL}/${item.activity_id}`,
      });
      capture('activity_shared', { activity_id: item.activity_id });
    } catch {/* user cancelled */}
  }

  function goDetail() { router.push(`/activity/${item.activity_id}` as any); }
  function goLikers() { router.push(`/activity/${item.activity_id}/likes` as any); }
  function goComments() { router.push(`/activity/${item.activity_id}/comments` as any); }
  function goProfile() { router.push(`/user/${item.user_id}` as any); }

  const showPace     = isOwner || !item.hide_pace;
  const showCalories = isOwner || !item.hide_calories;
  const title        = item.title ?? autoTitle(item.type, item.started_at);

  const photos = item.photo_count > 0 && item.cover_photo_path
    ? [item.cover_photo_path]
    : [];

  return (
    <View className="bg-white mb-2">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-3 pb-2">
        <Pressable onPress={goProfile}>
          <Avatar
            size={40}
            displayName={item.display_name}
            color={item.color}
            avatarUrl={item.avatar_url}
          />
        </Pressable>
        <Pressable onPress={goProfile} className="flex-1 ml-3">
          <View className="flex-row items-center">
            <Text className="text-gray-900 font-semibold text-sm">{item.display_name}</Text>
            <VisibilityBadge value={item.visibility} />
          </View>
          <View className="flex-row items-center mt-0.5">
            <TypeIcon type={item.type} size={11} />
            <Text className="text-gray-500 text-xs ml-1">
              {relativeTime(item.started_at)}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Title + description */}
      <Pressable onPress={goDetail}>
        <View className="px-4 pb-2">
          <Text className="text-gray-900 font-bold text-lg">{title}</Text>
          {item.description ? (
            <Text className="text-gray-700 text-sm mt-1" numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>

        {/* Stats */}
        <View className="flex-row px-4 pb-3">
          <View className="flex-1">
            <Text className="text-gray-400 text-[10px] uppercase tracking-wider">Distance</Text>
            <Text className="text-gray-900 text-base font-bold mt-0.5">
              {formatDistance(item.distance_m)}
            </Text>
          </View>
          {showPace && (
            <View className="flex-1">
              <Text className="text-gray-400 text-[10px] uppercase tracking-wider">Pace</Text>
              <Text className="text-gray-900 text-base font-bold mt-0.5">
                {formatPace(item.distance_m, item.duration_s)}
              </Text>
            </View>
          )}
          {item.area_captured_m2 > 0 && (
            <View className="flex-1">
              <Text className="text-gray-400 text-[10px] uppercase tracking-wider">Area</Text>
              <Text className="text-gray-900 text-base font-bold mt-0.5">
                {formatArea(item.area_captured_m2)}
              </Text>
            </View>
          )}
          {showCalories && item.calories ? (
            <View className="flex-1">
              <Text className="text-gray-400 text-[10px] uppercase tracking-wider">Calories</Text>
              <Text className="text-gray-900 text-base font-bold mt-0.5">{item.calories}</Text>
            </View>
          ) : null}
        </View>

        {/* Map */}
        {(item.capture_polygon_geojson || item.trace_geojson) && (
          <StaticActivityMap
            polygon={item.capture_polygon_geojson}
            path={item.trace_geojson}
            ownerColor={item.color}
            height={220}
          />
        )}

        {/* Photo strip */}
        {photos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="bg-gray-50"
            contentContainerStyle={{ padding: 8 }}
          >
            {photos.map((path) => (
              <Image
                key={path}
                source={{ uri: activityPhotoUrl(path) }}
                style={{ width: 140, height: 140, borderRadius: 8, marginRight: 8 }}
              />
            ))}
          </ScrollView>
        )}
      </Pressable>

      {/* Action row */}
      <View className="flex-row items-center px-4 py-3 border-t border-gray-100">
        <TouchableOpacity onPress={onToggleLike} hitSlop={8} className="flex-row items-center mr-6">
          <Heart
            size={22}
            color={liked ? '#EF4444' : '#6B7280'}
            fill={liked ? '#EF4444' : 'transparent'}
          />
          {likeCnt > 0 && (
            <Pressable onPress={goLikers} hitSlop={8}>
              <Text className="text-gray-700 text-sm font-medium ml-2">{likeCnt}</Text>
            </Pressable>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={goComments} hitSlop={8} className="flex-row items-center mr-6">
          <MessageCircle size={22} color="#6B7280" />
          {item.comment_count > 0 && (
            <Text className="text-gray-700 text-sm font-medium ml-2">{item.comment_count}</Text>
          )}
        </TouchableOpacity>

        <View className="flex-1" />

        <TouchableOpacity onPress={onShare} hitSlop={8}>
          <Share2 size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
