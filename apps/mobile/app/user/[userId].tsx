import { useCallback, useState } from 'react';
import {
  View, ScrollView, ActivityIndicator,
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
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { useTokens } from '@/lib/useTokens';

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

function ActivityIcon({ type, color }: { type: ActivityType; color: string }) {
  const size = 16;
  if (type === 'cycle') return <Bike size={size} color={color} />;
  if (type === 'hike') return <Mountain size={size} color={color} />;
  if (type === 'run') return <Activity size={size} color={color} />;
  return <PersonStanding size={size} color={color} />;
}

function StatBlock({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View className="flex-1 items-center">
      <Text variant="h3" style={{ color: accent }}>{value}</Text>
      <Text variant="tag" tone="muted" align="center" style={{ marginTop: 4 }}>{label}</Text>
    </View>
  );
}

function ActivityRow({ item }: { item: UserActivity }) {
  const { colors } = useTokens();
  return (
    <View
      className="px-4 py-3 flex-row items-center"
      style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <View
        style={{
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: colors.surfaceAlt,
          borderWidth: 1, borderColor: colors.border,
          alignItems: 'center', justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <ActivityIcon type={item.type} color={colors.accent} />
      </View>
      <View className="flex-1">
        <Text variant="captionStrong" style={{ textTransform: 'capitalize' }}>{item.type}</Text>
        <Text variant="tag" tone="muted" style={{ marginTop: 2 }}>
          {formatDistance(item.distance_m)} · {formatDuration(item.duration_s)}
          {item.area_captured_m2 > 0 ? ` · ${formatArea(item.area_captured_m2)}` : ''}
          {item.calories ? ` · ${item.calories} kcal` : ''}
        </Text>
      </View>
      <Text variant="tag" tone="subtle">{relativeTime(item.started_at)}</Text>
    </View>
  );
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const myUserId = useAuthStore((s) => s.user?.id);
  const isOwn = userId === myUserId;
  const { colors } = useTokens();

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
      <SafeAreaView className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center px-2 py-2">
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} className="p-2">
            <ChevronLeft size={24} color={colors.ink} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text variant="caption" tone="subtle" align="center">Profile not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View
        className="flex-row items-center px-2 py-2"
        style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} className="p-2">
          <ChevronLeft size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text variant="bodyStrong" style={{ marginLeft: 4 }}>Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
      >
        {/* Identity header */}
        <View
          className="items-center px-6 pt-8 pb-6"
          style={{ backgroundColor: colors.surface }}
        >
          <View className="mb-3">
            <Avatar
              size={80}
              displayName={profile.display_name}
              color={profile.color}
              avatarUrl={profile.avatar_url}
            />
          </View>
          <Text variant="h3" tone="strong">{profile.display_name}</Text>
          <Text variant="caption" tone="subtle" style={{ marginBottom: 16 }}>@{profile.username}</Text>

          {!isOwn && (
            <TouchableOpacity
              onPress={handleToggleFollow}
              disabled={followBusy}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 20, paddingVertical: 8,
                borderRadius: 9999, borderWidth: 1,
                backgroundColor: profile.is_following ? colors.surface : colors.ctaBg,
                borderColor:     profile.is_following ? colors.borderInput : colors.ctaBg,
              }}
              activeOpacity={0.8}
            >
              {profile.is_following ? (
                <>
                  <Check size={16} color={colors.ink} />
                  <Text variant="captionStrong" style={{ marginLeft: 6 }}>Following</Text>
                </>
              ) : (
                <>
                  <Plus size={16} color={colors.ctaFg} />
                  <Text variant="captionStrong" style={{ marginLeft: 6, color: colors.ctaFg }}>Follow</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Stats grid */}
        <Card padding={20} elevation="whisper" style={{ marginHorizontal: 16, marginTop: 12 }}>
          <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase', marginBottom: 16 }}>
            Lifetime stats
          </Text>
          <View className="flex-row mb-4">
            <StatBlock label="Distance" value={formatDistance(profile.total_distance_m)} accent={colors.accent} />
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <StatBlock label="Area held" value={formatArea(profile.total_area_m2)} accent={colors.accent} />
          </View>
          <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 16 }} />
          <View className="flex-row">
            <StatBlock
              label="Calories"
              value={profile.total_calories > 0 ? `${profile.total_calories.toLocaleString()} kcal` : '—'}
              accent={colors.accent}
            />
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <StatBlock label="Activities" value={`${profile.total_activities}`} accent={colors.accent} />
          </View>
        </Card>

        {/* Recent activities */}
        <View className="mt-6">
          <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 8 }}>
            Recent activities
          </Text>
          {activities.length === 0 ? (
            <View className="px-6 py-10 items-center" style={{ backgroundColor: colors.surface }}>
              <Text variant="caption" tone="subtle">No activities yet</Text>
            </View>
          ) : (
            activities.map((a) => <ActivityRow key={a.activity_id} item={a} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
