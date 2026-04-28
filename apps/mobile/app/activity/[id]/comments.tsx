import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ChevronLeft, Send, Trash2 } from 'lucide-react-native';
import { Avatar } from '@/components/ui/Avatar';
import {
  listActivityComments, createActivityComment, deleteActivityComment,
} from '@/lib/activities';
import { capture } from '@/lib/analytics';
import { useAuthStore } from '@/stores/auth-store';
import type { ActivityComment } from '@/types/api';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CommentRow({
  c, onDelete, canDelete,
}: { c: ActivityComment; onDelete: () => void; canDelete: boolean }) {
  return (
    <View className="flex-row items-start px-4 py-3 bg-white border-b border-gray-100">
      <Avatar size={36} displayName={c.display_name} color={c.color} avatarUrl={c.avatar_url} />
      <View className="flex-1 ml-3">
        <View className="flex-row items-baseline">
          <Text className="text-gray-900 font-semibold text-sm">{c.display_name}</Text>
          <Text className="text-gray-400 text-[11px] ml-2">{relativeTime(c.created_at)}</Text>
        </View>
        <Text className="text-gray-700 text-sm mt-1">{c.body}</Text>
      </View>
      {canDelete && (
        <TouchableOpacity onPress={onDelete} hitSlop={8} className="p-1">
          <Trash2 size={16} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ActivityCommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const myId = useAuthStore((s) => s.user?.id);

  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await listActivityComments(id, 100);
      setComments(data); // newest-first as the RPC returns
    } catch (e) {
      console.error('[activity-comments] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onPost() {
    if (posting || !id) return;
    const body = draft.trim();
    if (body.length === 0) return;
    setPosting(true);
    try {
      const c = await createActivityComment(id, body);
      setComments((cs) => [c, ...cs]); // newest-first
      setDraft('');
      capture('activity_commented', { activity_id: id });
    } catch (e) {
      console.error('[activity-comments] post error:', e);
    } finally {
      setPosting(false);
    }
  }

  async function onDelete(c: ActivityComment) {
    setComments((cs) => cs.filter((x) => x.comment_id !== c.comment_id));
    try {
      await deleteActivityComment(c.comment_id);
    } catch (e) {
      console.error('[activity-comments] delete error:', e);
      // Reload to reconcile state
      load(true);
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
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-row items-center px-2 py-2 bg-white border-b border-gray-100">
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} className="p-2">
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text className="text-base font-semibold text-gray-900 ml-1">Comments</Text>
        </View>

        <FlatList
          data={comments}
          keyExtractor={(item) => item.comment_id}
          renderItem={({ item }) => (
            <CommentRow
              c={item}
              canDelete={item.user_id === myId}
              onDelete={() => onDelete(item)}
            />
          )}
          onRefresh={() => load(true)}
          refreshing={refreshing}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-24 px-8">
              <Text className="text-gray-400 text-sm text-center">No comments yet.</Text>
            </View>
          }
          contentContainerStyle={comments.length === 0 ? { flex: 1 } : undefined}
        />

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
            onPress={onPost}
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
