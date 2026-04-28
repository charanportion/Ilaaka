import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ChevronLeft, Plus, Check } from 'lucide-react-native';
import { Avatar } from '@/components/ui/Avatar';
import { listActivityLikers } from '@/lib/activities';
import { followUser, unfollowUser } from '@/lib/friends';
import { useAuthStore } from '@/stores/auth-store';
import type { ActivityLiker } from '@/types/api';

function LikerRow({
  liker, onToggleFollow, isMe,
}: { liker: ActivityLiker; onToggleFollow: () => void; isMe: boolean }) {
  const router = useRouter();
  return (
    <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
      <Pressable
        onPress={() => router.push(`/user/${liker.user_id}` as any)}
        className="flex-row items-center flex-1"
      >
        <Avatar size={40} displayName={liker.display_name} color={liker.color} avatarUrl={liker.avatar_url} />
        <View className="ml-3 flex-1">
          <Text className="text-gray-900 font-semibold text-sm">{liker.display_name}</Text>
          <Text className="text-gray-400 text-xs">@{liker.username}</Text>
        </View>
      </Pressable>
      {!isMe && (
        <TouchableOpacity
          onPress={onToggleFollow}
          className={`flex-row items-center px-4 py-1.5 rounded-full border ${
            liker.is_following
              ? 'bg-white border-gray-200'
              : 'bg-indigo-500 border-indigo-500'
          }`}
          activeOpacity={0.8}
        >
          {liker.is_following ? (
            <>
              <Check size={14} color="#6366F1" />
              <Text className="text-indigo-600 text-xs font-semibold ml-1">Following</Text>
            </>
          ) : (
            <>
              <Plus size={14} color="white" />
              <Text className="text-white text-xs font-semibold ml-1">Follow</Text>
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
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-2 py-2 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} className="p-2">
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900 ml-1">Likes</Text>
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
            <Text className="text-gray-400 text-sm text-center">
              No likes yet.
            </Text>
          </View>
        }
        contentContainerStyle={likers.length === 0 ? { flex: 1 } : undefined}
      />
    </SafeAreaView>
  );
}
