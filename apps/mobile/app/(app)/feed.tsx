import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { fetchFriendsFeed } from '@/lib/friends';
import { capture } from '@/lib/analytics';
import { ActivityCard } from '@/components/feed/ActivityCard';
import type { FeedItem } from '@/types/api';

export default function FeedScreen() {
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchFriendsFeed(20);
      setItems(data);
      if (!isRefresh) capture('feed_opened', { item_count: data.length });
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <FlatList
        data={items}
        keyExtractor={(item) => item.activity_id}
        renderItem={({ item }) => <ActivityCard item={item} />}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-24 px-8">
            <Text className="text-gray-400 text-sm text-center mb-4">
              Follow people to see their activities here.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(app)/friends')}
              className="bg-indigo-500 px-5 py-2.5 rounded-full"
            >
              <Text className="text-white font-semibold text-sm">Find friends</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={items.length === 0 ? { flex: 1 } : undefined}
      />
    </SafeAreaView>
  );
}
