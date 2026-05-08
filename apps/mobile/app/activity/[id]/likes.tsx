import { useCallback, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, ActivityIndicator, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ChevronLeft, Plus, Check } from 'lucide-react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { useTokens } from '@/lib/useTokens';
import { listActivityLikers } from '@/lib/activities';
import { followUser, unfollowUser } from '@/lib/friends';
import { useAuthStore } from '@/stores/auth-store';
import type { ActivityLiker } from '@/types/api';

function LikerRow({
  liker, onToggleFollow, isMe,
}: { liker: ActivityLiker; onToggleFollow: () => void; isMe: boolean }) {
  const router = useRouter();
  const { colors } = useTokens();
  return (
    <View
      className="flex-row items-center px-4 py-3"
      style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <Pressable
        onPress={() => router.push(`/user/${liker.user_id}` as any)}
        className="flex-row items-center flex-1"
      >
        <Avatar size={40} displayName={liker.display_name} color={liker.color} avatarUrl={liker.avatar_url} />
        <View className="ml-3 flex-1">
          <Text variant="captionStrong">{liker.display_name}</Text>
          <Text variant="tag" tone="subtle">@{liker.username}</Text>
        </View>
      </Pressable>
      {!isMe && (
        <TouchableOpacity
          onPress={onToggleFollow}
          style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 6,
            borderRadius: 9999, borderWidth: 1,
            backgroundColor: liker.is_following ? colors.surface : colors.ctaBg,
            borderColor:     liker.is_following ? colors.borderInput : colors.ctaBg,
          }}
          activeOpacity={0.8}
        >
          {liker.is_following ? (
            <>
              <Check size={14} color={colors.ink} />
              <Text variant="tag" tone="strong" style={{ marginLeft: 4 }}>Following</Text>
            </>
          ) : (
            <>
              <Plus size={14} color={colors.ctaFg} />
              <Text variant="tag" style={{ marginLeft: 4, color: colors.ctaFg }}>Follow</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ActivityLikesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const myId = useAuthStore((s) => s.user?.id);
  const { colors } = useTokens();

  const [likers, setLikers] = useState<ActivityLiker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await listActivityLikers(id, 100);
      setLikers(data);
    } catch (e) {
      console.error('[activity-likes] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleToggleFollow(target: ActivityLiker) {
    const next = !target.is_following;
    setLikers((arr) => arr.map((u) => u.user_id === target.user_id ? { ...u, is_following: next } : u));
    try {
      if (next) await followUser(target.user_id);
      else      await unfollowUser(target.user_id);
    } catch {
      setLikers((arr) => arr.map((u) => u.user_id === target.user_id ? { ...u, is_following: !next } : u));
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <View
        className="flex-row items-center px-2 py-2"
        style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} className="p-2">
          <ChevronLeft size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text variant="bodyStrong" style={{ marginLeft: 4 }}>Likes</Text>
      </View>

      <FlatList
        data={likers}
        keyExtractor={(item) => item.user_id}
        renderItem={({ item }) => (
          <LikerRow
            liker={item}
            isMe={item.user_id === myId}
            onToggleFollow={() => handleToggleFollow(item)}
          />
        )}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-24 px-8">
            <Text variant="caption" tone="subtle" align="center">No likes yet.</Text>
          </View>
        }
        contentContainerStyle={likers.length === 0 ? { flex: 1 } : undefined}
      />
    </SafeAreaView>
  );
}
