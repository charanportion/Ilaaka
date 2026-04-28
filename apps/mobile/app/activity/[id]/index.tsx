import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Image,
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
function TypeIcon({ type, size = 14 }: { type: ActivityType; size?: number }) {
  const color = '#6366F1';
  if (type === 'cycle') return <Bike size={size} color={color} />;
  if (type === 'hike')  return <Mountain size={size} color={color} />;
  if (type === 'run')   return <ActivityIconBase size={size} color={color} />;
  return <PersonStanding size={size} color={color} />;
}

function CommentRow({ c }: { c: ActivityComment }) {
  return (
    <View className="flex-row px-4 py-3 border-b border-gray-100 bg-white">
      <Avatar size={32} displayName={c.display_name} color={c.color} avatarUrl={c.avatar_url} />
      <View className="flex-1 ml-3">
        <View className="flex-row items-baseline">
          <Text className="text-gray-900 font-semibold text-sm">{c.display_name}</Text>
          <Text className="text-gray-400 text-[11px] ml-2">{relativeTime(c.created_at)}</Text>
        </View>
        <Text className="text-gray-700 text-sm mt-0.5">{c.body}</Text>
      </View>
    </View>
  );
}

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const myId = useAuthStore((s) => s.user?.id);

  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [liking, setLiking] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [d, cs] = await Promise.all([
        getActivityDetail(id),
        listActivityComments(id, 50),
      ]);
      setDetail(d);
      // newest-first from RPC; flip to chronological top→bottom for the inline thread
      setComments([...cs].reverse());
      if (!isRefresh && d) capture('activity_detail_opened', { activity_id: id });
    } catch (e) {
      console.error('[activity-detail] load error:', e);
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
      console.error('[activity-detail] post comment error:', e);
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
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }
  if (!detail) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-row items-center px-2 py-2">
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} className="p-2">
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-gray-400 text-sm text-center">Activity not found or hidden.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner       = myId === detail.user_id;
  const showPace      = isOwner || !detail.hide_pace;
  const showCalories  = isOwner || !detail.hide_calories;
  const title         = detail.title ?? autoTitle(detail.type, detail.started_at);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Top bar */}
        <View className="flex-row items-center px-2 py-2 bg-white border-b border-gray-100">
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} className="p-2">
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text className="text-base font-semibold text-gray-900 ml-1 flex-1">Activity</Text>
          <TouchableOpacity onPress={onShare} hitSlop={12} className="p-2">
            <Share2 size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#6366F1" />}
        >
          {/* Header */}
          <View className="bg-white px-4 pt-4 pb-2 flex-row items-center">
            <Pressable onPress={() => router.push(`/user/${detail.user_id}` as any)}>
              <Avatar size={48} displayName={detail.display_name} color={detail.color} avatarUrl={detail.avatar_url} />
            </Pressable>
            <View className="flex-1 ml-3">
              <View className="flex-row items-center">
                <Text className="text-gray-900 font-semibold text-base">{detail.display_name}</Text>
                {detail.visibility !== 'public' && (
                  <View className="flex-row items-center bg-gray-100 rounded-full px-2 py-0.5 ml-2">
                    {detail.visibility === 'private'
                      ? <Lock size={10} color="#6B7280" />
                      : <Users size={10} color="#6B7280" />}
                    <Text className="text-[10px] text-gray-500 ml-1 font-medium">
                      {detail.visibility === 'private' ? 'Only you' : 'Followers'}
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-row items-center mt-0.5">
                <TypeIcon type={detail.type} size={12} />
                <Text className="text-gray-500 text-xs ml-1">
                  {new Date(detail.started_at).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Title + description */}
          <View className="bg-white px-4 pb-3">
            <Text className="text-gray-900 font-bold text-2xl">{title}</Text>
            {detail.description ? (
              <Text className="text-gray-700 text-base mt-2">{detail.description}</Text>
            ) : null}
          </View>

          {/* Stats grid */}
          <View className="bg-white px-4 pb-4 flex-row flex-wrap">
            <View className="w-1/2 mb-3">
              <Text className="text-gray-400 text-[10px] uppercase tracking-wider">Distance</Text>
              <Text className="text-gray-900 text-lg font-bold mt-0.5">{formatDistance(detail.distance_m)}</Text>
            </View>
            <View className="w-1/2 mb-3">
              <Text className="text-gray-400 text-[10px] uppercase tracking-wider">Duration</Text>
              <Text className="text-gray-900 text-lg font-bold mt-0.5">{formatDuration(detail.duration_s)}</Text>
            </View>
            {showPace && (
              <View className="w-1/2 mb-3">
                <Text className="text-gray-400 text-[10px] uppercase tracking-wider">Pace</Text>
                <Text className="text-gray-900 text-lg font-bold mt-0.5">{formatPace(detail.distance_m, detail.duration_s)}</Text>
              </View>
            )}
            {detail.area_captured_m2 > 0 && (
              <View className="w-1/2 mb-3">
                <Text className="text-gray-400 text-[10px] uppercase tracking-wider">Area captured</Text>
                <Text className="text-gray-900 text-lg font-bold mt-0.5">{formatArea(detail.area_captured_m2)}</Text>
              </View>
            )}
            {showCalories && detail.calories ? (
              <View className="w-1/2 mb-3">
                <Text className="text-gray-400 text-[10px] uppercase tracking-wider">Calories</Text>
                <Text className="text-gray-900 text-lg font-bold mt-0.5">{detail.calories}</Text>
              </View>
            ) : null}
          </View>

          {/* Map */}
          {(detail.capture_polygon_geojson || detail.trace_geojson) && (
            <View className="bg-white">
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
              className="bg-white"
              contentContainerStyle={{ padding: 12 }}
            >
              {detail.photo_paths.map((path) => (
                <Image
                  key={path}
                  source={{ uri: activityPhotoUrl(path) }}
                  style={{ width: 200, height: 200, borderRadius: 12, marginRight: 12 }}
                />
              ))}
            </ScrollView>
          )}

          {/* Action row */}
          <View className="flex-row items-center px-4 py-3 bg-white border-t border-gray-100 mt-2">
            <TouchableOpacity onPress={onToggleLike} hitSlop={8} className="flex-row items-center mr-6">
              <Heart
                size={24}
                color={detail.has_liked ? '#EF4444' : '#6B7280'}
                fill={detail.has_liked ? '#EF4444' : 'transparent'}
              />
              <Pressable onPress={() => router.push(`/activity/${detail.activity_id}/likes` as any)} hitSlop={8}>
                <Text className="text-gray-700 text-sm font-medium ml-2">
                  {detail.like_count} {detail.like_count === 1 ? 'like' : 'likes'}
                </Text>
              </Pressable>
            </TouchableOpacity>

            <View className="flex-row items-center">
              <MessageCircle size={22} color="#6B7280" />
              <Text className="text-gray-700 text-sm font-medium ml-2">
                {detail.comment_count} {detail.comment_count === 1 ? 'comment' : 'comments'}
              </Text>
            </View>
          </View>

          {/* Comments */}
          <View className="mt-2">
            {comments.length === 0 ? (
              <View className="bg-white px-4 py-8 items-center">
                <Text className="text-gray-400 text-sm">Be the first to comment</Text>
              </View>
            ) : (
              comments.map((c) => <CommentRow key={c.comment_id} c={c} />)
            )}
          </View>
        </ScrollView>

        {/* Composer */}
        <View className="border-t border-gray-200 bg-white px-3 py-2 flex-row items-center">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a comment…"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            className="flex-1 text-gray-900 text-sm px-3 py-2 bg-gray-100 rounded-full"
            style={{ maxHeight: 120 }}
          />
          <TouchableOpacity
            onPress={onPostComment}
            disabled={posting || draft.trim().length === 0}
            className={`ml-2 p-2 rounded-full ${draft.trim().length > 0 ? 'bg-indigo-500' : 'bg-gray-200'}`}
            hitSlop={4}
          >
            <Send size={18} color={draft.trim().length > 0 ? '#FFFFFF' : '#9CA3AF'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
