import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft, Plus, Check, PersonStanding, Bike, Mountain, Activity,
} from 'lucide-react-native';
import { fetchUserPublicProfile, fetchUserRecentActivities } from '@/lib/users';
import { followUser, unfollowUser } from '@/lib/friends';
import { useAuthStore } from '@/stores/auth-store';
import { capture } from '@/lib/analytics';
import type { UserPublicProfile, UserActivity, ActivityType } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

function formatArea(m2: number): string {
  if (m2 < 10_000) return `${m2.toLocaleString()} m²`;
  return `${(m2 / 10_000).toFixed(2)} ha`;
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ActivityIcon({ type }: { type: ActivityType }) {
  const color = '#6366F1';
  const size = 16;
  if (type === 'cycle') return <Bike size={size} color={color} />;
  if (type === 'hike') return <Mountain size={size} color={color} />;
  if (type === 'run') return <Activity size={size} color={color} />;
  return <PersonStanding size={size} color={color} />;
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-xl font-bold text-indigo-600">{value}</Text>
      <Text className="text-xs text-gray-500 mt-1 text-center">{label}</Text>
    </View>
  );
}

function ActivityRow({ item }: { item: UserActivity }) {
  return (
    <View className="px-4 py-3 border-b border-gray-100 bg-white flex-row items-center">
      <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center mr-3">
        <ActivityIcon type={item.type} />
      </View>
      <View className="flex-1">
        <Text className="text-gray-900 text-sm font-semibold capitalize">
          {item.type}
        </Text>
        <Text className="text-gray-500 text-xs mt-0.5">
          {formatDistance(item.distance_m)} · {formatDuration(item.duration_s)}
          {item.area_captured_m2 > 0 ? ` · ${formatArea(item.area_captured_m2)}` : ''}
          {item.calories ? ` · ${item.calories} kcal` : ''}
        </Text>
      </View>
      <Text className="text-gray-400 text-xs">{relativeTime(item.started_at)}</Text>
    </View>
  );
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const myUserId = useAuthStore((s) => s.user?.id);
  const isOwn = userId === myUserId;

  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!userId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [p, acts] = await Promise.all([
        fetchUserPublicProfile(userId),
        fetchUserRecentActivities(userId, 10),
      ]);
      setProfile(p);
      setActivities(acts);
    } catch (e) {
      console.error('[user-profile] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  async function handleToggleFollow() {
    if (!profile || isOwn || followBusy) return;
    const next = !profile.is_following;
    setFollowBusy(true);
    setProfile({ ...profile, is_following: next });
    try {
      if (next) {
        await followUser(profile.id);
        capture('friend_followed', { followee_id: profile.id });
      } else {
        await unfollowUser(profile.id);
        capture('friend_unfollowed', { followee_id: profile.id });
      }
    } catch (e) {
      console.error('[user-profile] follow toggle error:', e);
      setProfile({ ...profile, is_following: !next });
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-row items-center px-2 py-2">
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} className="p-2">
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-gray-400 text-sm text-center">
            Profile not found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Top bar */}
      <View className="flex-row items-center px-2 py-2 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} className="p-2">
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900 ml-1">Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#6366F1" />}
      >
        {/* Identity header */}
        <View className="items-center px-6 pt-8 pb-6 bg-white">
          <View className="mb-3">
            <Avatar
              size={80}
              displayName={profile.display_name}
              color={profile.color}
              avatarUrl={profile.avatar_url}
            />
          </View>
          <Text className="text-xl font-bold text-gray-900">{profile.display_name}</Text>
          <Text className="text-sm text-gray-400 mb-4">@{profile.username}</Text>

          {!isOwn && (
            <TouchableOpacity
              onPress={handleToggleFollow}
              disabled={followBusy}
              className={`flex-row items-center px-5 py-2 rounded-full border ${
                profile.is_following
                  ? 'bg-white border-gray-200'
                  : 'bg-indigo-500 border-indigo-500'
              }`}
              activeOpacity={0.8}
            >
              {profile.is_following ? (
                <>
                  <Check size={16} color="#6366F1" />
                  <Text className="text-indigo-600 text-sm font-semibold ml-1.5">
                    Following
                  </Text>
                </>
              ) : (
                <>
                  <Plus size={16} color="white" />
                  <Text className="text-white text-sm font-semibold ml-1.5">
                    Follow
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Stats grid */}
        <View className="bg-white mt-3 mx-4 rounded-2xl p-5 shadow-sm">
          <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Lifetime stats
          </Text>
          <View className="flex-row mb-4">
            <StatBlock label="Distance" value={formatDistance(profile.total_distance_m)} />
            <View className="w-px bg-gray-100" />
            <StatBlock label="Area held" value={formatArea(profile.total_area_m2)} />
          </View>
          <View className="h-px bg-gray-100 mb-4" />
          <View className="flex-row">
            <StatBlock
              label="Calories"
              value={profile.total_calories > 0 ? `${profile.total_calories.toLocaleString()} kcal` : '—'}
            />
            <View className="w-px bg-gray-100" />
            <StatBlock label="Activities" value={`${profile.total_activities}`} />
          </View>
        </View>

        {/* Recent activities */}
        <View className="mt-6">
          <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-4 mb-2">
            Recent activities
          </Text>
          {activities.length === 0 ? (
            <View className="px-6 py-10 items-center bg-white">
              <Text className="text-gray-400 text-sm">No activities yet</Text>
            </View>
          ) : (
            activities.map((a) => <ActivityRow key={a.activity_id} item={a} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
