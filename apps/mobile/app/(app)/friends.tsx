import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, TextInput, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Plus, Check } from 'lucide-react-native';
import {
  searchUsers, followUser, unfollowUser,
  listFollowing, listFollowers,
} from '@/lib/friends';
import { capture } from '@/lib/analytics';
import type { UserSearchResult } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/Toast';
import { useTokens } from '@/lib/useTokens';
import { typography } from '@/lib/design-tokens';

type Tab = 'search' | 'following' | 'followers';

type UserRowProps = {
  user: UserSearchResult;
  onToggleFollow: (user: UserSearchResult) => void;
  onOpenProfile: (userId: string) => void;
};

function UserRow({ user, onToggleFollow, onOpenProfile }: UserRowProps) {
  const { colors } = useTokens();
  return (
    <View className="flex-row items-center px-4 py-3">
      <TouchableOpacity
        onPress={() => onOpenProfile(user.id)}
        className="flex-row items-center flex-1"
        activeOpacity={0.7}
      >
        <View className="mr-3">
          <Avatar
            size={40}
            displayName={user.display_name}
            color={user.color}
            avatarUrl={user.avatar_url}
          />
        </View>
        <View className="flex-1">
          <Text variant="captionStrong">{user.display_name}</Text>
          <Text variant="tag" tone="subtle">@{user.username}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onToggleFollow(user)}
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 12, paddingVertical: 6,
          borderRadius: 9999, borderWidth: 1,
          backgroundColor: user.is_following ? colors.surface : colors.ctaBg,
          borderColor:     user.is_following ? colors.borderInput : colors.ctaBg,
        }}
        activeOpacity={0.8}
      >
        {user.is_following ? (
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
    </View>
  );
}

export default function FriendsScreen() {
  const router = useRouter();
  const { colors } = useTokens();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [following, setFollowing] = useState<UserSearchResult[]>([]);
  const [followers, setFollowers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'search') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (query.trim().length < 2) { setSearchResults([]); return; }
      setLoading(true);
      try {
        capture('friend_search_performed', { query_length: query.trim().length });
        const results = await searchUsers(query);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
        toast.show({ tone: 'error', message: 'Search failed — check your connection.' });
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [query, activeTab, toast]);

  async function loadFollowing() {
    setLoading(true);
    try {
      setFollowing(await listFollowing());
    } catch {
      setFollowing([]);
      toast.show({ tone: 'error', message: 'Couldn’t load who you follow.' });
    } finally {
      setLoading(false);
    }
  }

  async function loadFollowers() {
    setLoading(true);
    try {
      setFollowers(await listFollowers());
    } catch {
      setFollowers([]);
      toast.show({ tone: 'error', message: 'Couldn’t load your followers.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'following') loadFollowing();
    else if (activeTab === 'followers') loadFollowers();
  }, [activeTab]);

  useFocusEffect(useCallback(() => {
    if (activeTab === 'following') loadFollowing();
    else if (activeTab === 'followers') loadFollowers();
  }, [activeTab]));

  async function handleToggleFollow(user: UserSearchResult) {
    const toggle = (list: UserSearchResult[]) =>
      list.map((u) => u.id === user.id ? { ...u, is_following: !u.is_following } : u);
    setSearchResults((l) => toggle(l));
    setFollowing((l) => toggle(l));
    setFollowers((l) => toggle(l));

    try {
      if (user.is_following) {
        await unfollowUser(user.id);
        capture('friend_unfollowed', { followee_id: user.id });
      } else {
        await followUser(user.id);
        capture('friend_followed', { followee_id: user.id });
      }
    } catch {
      const revert = (list: UserSearchResult[]) =>
        list.map((u) => u.id === user.id ? { ...u, is_following: user.is_following } : u);
      setSearchResults((l) => revert(l));
      setFollowing((l) => revert(l));
      setFollowers((l) => revert(l));
      toast.show({
        tone: 'error',
        message: user.is_following ? 'Couldn’t unfollow.' : 'Couldn’t follow.',
        action: { label: 'Retry', onPress: () => handleToggleFollow(user) },
      });
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'search',    label: 'Search'    },
    { key: 'following', label: 'Following' },
    { key: 'followers', label: 'Followers' },
  ];

  const currentList =
    activeTab === 'search'    ? searchResults :
    activeTab === 'following' ? following     : followers;

  const emptyMessage =
    activeTab === 'search'    ? (query.length < 2 ? 'Search for friends to follow' : 'No users found') :
    activeTab === 'following' ? 'Not following anyone yet' :
                                'No followers yet';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      {/* Tab bar */}
      <View
        className="flex-row"
        style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={{
              flex: 1, paddingVertical: 12, alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? colors.accent : 'transparent',
            }}
          >
            <Text
              variant="captionStrong"
              style={{ color: activeTab === tab.key ? colors.accent : colors.inkMuted }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search input */}
      {activeTab === 'search' && (
        <View
          className="px-4 py-3"
          style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by username or name…"
            placeholderTextColor={colors.inkSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: colors.surfaceAlt,
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontFamily: typography.body.fontFamily,
              fontSize: 14,
              color: colors.ink,
            }}
          />
        </View>
      )}

      {/* List */}
      {loading && currentList.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              onToggleFollow={handleToggleFollow}
              onOpenProfile={(id) => router.push(`/user/${id}` as any)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-16">
              <Text variant="caption" tone="subtle">{emptyMessage}</Text>
            </View>
          }
          contentContainerStyle={currentList.length === 0 ? { flex: 1 } : undefined}
        />
      )}
    </SafeAreaView>
  );
}
