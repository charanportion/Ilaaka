import { useCallback, useState } from 'react';
import { View, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { fetchFriendsFeed } from '@/lib/friends';
import { capture } from '@/lib/analytics';
import { ActivityCard } from '@/components/feed/ActivityCard';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { ScreenState } from '@/components/ScreenState';
import type { FeedItem } from '@/types/api';

export default function FeedScreen() {
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchFriendsFeed(20);
      setItems(data);
      if (!isRefresh) capture('feed_opened', { item_count: data.length });
    } catch (e) {
      // Keep any stale data so the user can still scroll, but surface the error
      // when there is no data to fall back to.
      setError(e instanceof Error ? e.message : 'fetch_failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        <ScreenState variant="loading" />
      </SafeAreaView>
    );
  }

  // Hard error path — only when we have nothing to show. If we have stale
  // items, show them and let pull-to-refresh trigger the retry.
  if (error && items.length === 0) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        <ScreenState
          variant="error"
          title="Couldn’t load your feed"
          message="Check your connection and try again."
          retry={() => load()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <FlatList
        data={items}
        keyExtractor={(item) => item.activity_id}
        renderItem={({ item }) => <ActivityCard item={item} />}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-24 px-8">
            <Text variant="caption" tone="subtle" align="center" style={{ marginBottom: 16 }}>
              Follow people to see their activities here.
            </Text>
            <Button
              label="Find friends"
              variant="primary"
              size="md"
              onPress={() => router.push('/(app)/friends')}
            />
          </View>
        }
        contentContainerStyle={items.length === 0 ? { flex: 1 } : undefined}
      />
    </SafeAreaView>
  );
}
