import { useCallback, useState } from 'react';
import {
  View, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, RefreshControl, Pressable,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ChevronLeft, Heart, MessageCircle, Share2, Send, Lock, Users,
  PersonStanding, Bike, Mountain, Activity as ActivityIconBase,
} from 'lucide-react-native';
import { Avatar } from '@/components/ui/Avatar';
import { StaticActivityMap } from '@/components/feed/StaticActivityMap';
import { ActivityPhoto } from '@/components/ActivityPhoto';
import { Text } from '@/components/ui/Text';
import { ScreenState } from '@/components/ScreenState';
import { useToast } from '@/components/Toast';
import { useTokens } from '@/lib/useTokens';
import { typography } from '@/lib/design-tokens';
import {
  getActivityDetail, listActivityComments, createActivityComment,
  toggleActivityLike, activityPhotoUrl,
} from '@/lib/activities';
import { capture } from '@/lib/analytics';
import { useAuthStore } from '@/stores/auth-store';
import type { ActivityComment, ActivityDetail, ActivityType } from '@/types/api';

const SHARE_BASE_URL = 'https://ilaaka.app/activity';

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}
function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
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
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function autoTitle(type: ActivityType, startedAt: string): string {
  const verb = type === 'run' ? 'Run' : type === 'walk' ? 'Walk' : type === 'cycle' ? 'Ride' : 'Hike';
  const h = new Date(startedAt).getHours();
  const tod = h < 5 ? 'Late night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  return `${tod} ${verb}`;
}
function TypeIcon({ type, size = 14, color }: { type: ActivityType; size?: number; color: string }) {
  if (type === 'cycle') return <Bike size={size} color={color} />;
  if (type === 'hike')  return <Mountain size={size} color={color} />;
  if (type === 'run')   return <ActivityIconBase size={size} color={color} />;
  return <PersonStanding size={size} color={color} />;
}

function CommentRow({ c }: { c: ActivityComment }) {
  const { colors } = useTokens();
  return (
    <View
      className="flex-row px-4 py-3"
      style={{ borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}
    >
      <Avatar size={32} displayName={c.display_name} color={c.color} avatarUrl={c.avatar_url} />
      <View className="flex-1 ml-3">
        <View className="flex-row items-baseline">
          <Text variant="captionStrong">{c.display_name}</Text>
          <Text variant="tag" tone="subtle" style={{ marginLeft: 8 }}>{relativeTime(c.created_at)}</Text>
        </View>
        <Text variant="caption" style={{ marginTop: 2 }}>{c.body}</Text>
      </View>
    </View>
  );
}

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const myId = useAuthStore((s) => s.user?.id);
  const { colors } = useTokens();

  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [liking, setLiking] = useState(false);
  const toast = useToast();

  const load = useCallback(async (isRefresh = false) => {
    if (!id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadFailed(false);
    try {
      const [d, cs] = await Promise.all([
        getActivityDetail(id),
        listActivityComments(id, 50),
      ]);
      setDetail(d);
      setComments([...cs].reverse());
      if (!isRefresh && d) capture('activity_detail_opened', { activity_id: id });
    } catch (e) {
      // Treat fetch failure as different from "no such activity" — the latter
      // returns null without throwing. This way we don't show "Not found" when
      // the user is just offline.
      setLoadFailed(true);
      if (__DEV__) console.error('[activity-detail] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onToggleLike() {
    if (!detail || liking) return;
    const next = !detail.has_liked;
    setDetail({ ...detail, has_liked: next, like_count: detail.like_count + (next ? 1 : -1) });
    setLiking(true);
    try {
      const res = await toggleActivityLike(detail.activity_id);
      setDetail((d) => d ? { ...d, has_liked: res.liked, like_count: res.likeCount } : d);
      capture('activity_liked', { activity_id: detail.activity_id, liked: res.liked });
    } catch {
      setDetail((d) => d ? { ...d, has_liked: !next, like_count: d.like_count + (next ? -1 : 1) } : d);
      toast.show({ tone: 'error', message: 'Couldn’t update like — try again.' });
    } finally {
      setLiking(false);
    }
  }

  async function onPostComment() {
    if (!detail || posting) return;
    const body = draft.trim();
    if (body.length === 0) return;
    setPosting(true);
    try {
      const c = await createActivityComment(detail.activity_id, body);
      setComments((cs) => [...cs, c]);
      setDetail((d) => d ? { ...d, comment_count: d.comment_count + 1 } : d);
      setDraft('');
      capture('activity_commented', { activity_id: detail.activity_id });
    } catch (e) {
      if (__DEV__) console.error('[activity-detail] post comment error:', e);
      toast.show({ tone: 'error', message: 'Comment didn’t post. Try again.' });
    } finally {
      setPosting(false);
    }
  }

  async function onShare() {
    if (!detail) return;
    try {
      await Share.share({
        message: `${detail.display_name} on Ilaaka — ${detail.title ?? autoTitle(detail.type, detail.started_at)} (${formatDistance(detail.distance_m)})`,
        url:     `${SHARE_BASE_URL}/${detail.activity_id}`,
      });
      capture('activity_shared', { activity_id: detail.activity_id });
    } catch {/* user cancelled */}
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenState variant="loading" />
      </SafeAreaView>
    );
  }
  if (!detail) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-row items-center px-2 py-2">
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} className="p-2">
            <ChevronLeft size={24} color={colors.ink} />
          </TouchableOpacity>
        </View>
        <ScreenState
          variant={loadFailed ? 'error' : 'empty'}
          title={loadFailed ? 'Couldn’t load this activity' : 'Activity not found'}
          message={loadFailed ? 'Check your connection and try again.' : 'It may have been deleted or hidden.'}
          retry={loadFailed ? () => load() : undefined}
        />
      </SafeAreaView>
    );
  }

  const isOwner       = myId === detail.user_id;
  const showPace      = isOwner || !detail.hide_pace;
  const showCalories  = isOwner || !detail.hide_calories;
  const title         = detail.title ?? autoTitle(detail.type, detail.started_at);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Top bar */}
        <View
          className="flex-row items-center px-2 py-2"
          style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} className="p-2">
            <ChevronLeft size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text variant="bodyStrong" style={{ marginLeft: 4, flex: 1 }}>Activity</Text>
          <TouchableOpacity onPress={onShare} hitSlop={12} className="p-2">
            <Share2 size={20} color={colors.inkMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
        >
          {/* Header */}
          <View className="px-4 pt-4 pb-2 flex-row items-center" style={{ backgroundColor: colors.surface }}>
            <Pressable onPress={() => router.push(`/user/${detail.user_id}` as any)}>
              <Avatar size={48} displayName={detail.display_name} color={detail.color} avatarUrl={detail.avatar_url} />
            </Pressable>
            <View className="flex-1 ml-3">
              <View className="flex-row items-center">
                <Text variant="bodyStrong">{detail.display_name}</Text>
                {detail.visibility !== 'public' && (
                  <View
                    className="flex-row items-center rounded-pill px-2 py-0.5 ml-2"
                    style={{ backgroundColor: colors.surfaceAlt }}
                  >
                    {detail.visibility === 'private'
                      ? <Lock size={10} color={colors.inkMuted} />
                      : <Users size={10} color={colors.inkMuted} />}
                    <Text variant="tag" tone="muted" style={{ marginLeft: 4 }}>
                      {detail.visibility === 'private' ? 'Only you' : 'Followers'}
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-row items-center mt-0.5">
                <TypeIcon type={detail.type} size={12} color={colors.accent} />
                <Text variant="tag" tone="muted" style={{ marginLeft: 4 }}>
                  {new Date(detail.started_at).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Title + description */}
          <View className="px-4 pb-3" style={{ backgroundColor: colors.surface }}>
            <Text variant="h2" tone="strong">{title}</Text>
            {detail.description ? (
              <Text variant="body" style={{ marginTop: 8 }}>{detail.description}</Text>
            ) : null}
          </View>

          {/* Stats grid */}
          <View className="px-4 pb-4 flex-row flex-wrap" style={{ backgroundColor: colors.surface }}>
            <View className="w-1/2 mb-3">
              <Text variant="tag" tone="subtle" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Distance</Text>
              <Text variant="h3" tone="strong" style={{ marginTop: 2 }}>{formatDistance(detail.distance_m)}</Text>
            </View>
            <View className="w-1/2 mb-3">
              <Text variant="tag" tone="subtle" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Duration</Text>
              <Text variant="h3" tone="strong" style={{ marginTop: 2 }}>{formatDuration(detail.duration_s)}</Text>
            </View>
            {showPace && (
              <View className="w-1/2 mb-3">
                <Text variant="tag" tone="subtle" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Pace</Text>
                <Text variant="h3" tone="strong" style={{ marginTop: 2 }}>{formatPace(detail.distance_m, detail.duration_s)}</Text>
              </View>
            )}
            {detail.area_captured_m2 > 0 && (
              <View className="w-1/2 mb-3">
                <Text variant="tag" tone="subtle" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Area captured</Text>
                <Text variant="h3" tone="strong" style={{ marginTop: 2 }}>{formatArea(detail.area_captured_m2)}</Text>
              </View>
            )}
            {showCalories && detail.calories ? (
              <View className="w-1/2 mb-3">
                <Text variant="tag" tone="subtle" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Calories</Text>
                <Text variant="h3" tone="strong" style={{ marginTop: 2 }}>{detail.calories}</Text>
              </View>
            ) : null}
          </View>

          {/* Map */}
          {(detail.capture_polygon_geojson || detail.trace_geojson) && (
            <View style={{ backgroundColor: colors.surface }}>
              <StaticActivityMap
                polygon={detail.capture_polygon_geojson}
                path={detail.trace_geojson}
                ownerColor={detail.color}
                height={300}
              />
            </View>
          )}

          {/* Photos */}
          {detail.photo_paths.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ backgroundColor: colors.surface }}
              contentContainerStyle={{ padding: 12 }}
            >
              {detail.photo_paths.map((path) => (
                <ActivityPhoto
                  key={path}
                  uri={activityPhotoUrl(path)}
                  size={200}
                  style={{ marginRight: 12 }}
                />
              ))}
            </ScrollView>
          )}

          {/* Action row */}
          <View
            className="flex-row items-center px-4 py-3 mt-2"
            style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}
          >
            <TouchableOpacity onPress={onToggleLike} hitSlop={8} className="flex-row items-center mr-6">
              <Heart
                size={24}
                color={detail.has_liked ? colors.danger : colors.inkMuted}
                fill={detail.has_liked ? colors.danger : 'transparent'}
              />
              <Pressable onPress={() => router.push(`/activity/${detail.activity_id}/likes` as any)} hitSlop={8}>
                <Text variant="captionStrong" style={{ marginLeft: 8 }}>
                  {detail.like_count} {detail.like_count === 1 ? 'like' : 'likes'}
                </Text>
              </Pressable>
            </TouchableOpacity>

            <View className="flex-row items-center">
              <MessageCircle size={22} color={colors.inkMuted} />
              <Text variant="captionStrong" style={{ marginLeft: 8 }}>
                {detail.comment_count} {detail.comment_count === 1 ? 'comment' : 'comments'}
              </Text>
            </View>
          </View>

          {/* Comments */}
          <View className="mt-2">
            {comments.length === 0 ? (
              <View className="px-4 py-8 items-center" style={{ backgroundColor: colors.surface }}>
                <Text variant="caption" tone="subtle">Be the first to comment</Text>
              </View>
            ) : (
              comments.map((c) => <CommentRow key={c.comment_id} c={c} />)
            )}
          </View>
        </ScrollView>

        {/* Composer */}
        <View
          className="px-3 py-2 flex-row items-center"
          style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a comment…"
            placeholderTextColor={colors.inkSubtle}
            multiline
            maxLength={1000}
            style={{
              flex: 1,
              color: colors.ink,
              fontFamily: typography.body.fontFamily,
              fontSize: 14,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: colors.surfaceAlt,
              borderRadius: 9999,
              maxHeight: 120,
            }}
          />
          <TouchableOpacity
            onPress={onPostComment}
            disabled={posting || draft.trim().length === 0}
            className="ml-2 p-2 rounded-pill"
            style={{ backgroundColor: draft.trim().length > 0 ? colors.accent : colors.surfaceAlt }}
            hitSlop={4}
          >
            <Send size={18} color={draft.trim().length > 0 ? colors.ctaFg : colors.inkSubtle} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
