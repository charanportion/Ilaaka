import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator,
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

type Tab = 'search' | 'following' | 'followers';

type UserRowProps = {
  user: UserSearchResult;
  onToggleFollow: (user: UserSearchResult) => void;
  onOpenProfile: (userId: string) => void;
};

function UserRow({ user, onToggleFollow, onOpenProfile }: UserRowProps) {
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
          <Text className="text-gray-900 font-semibold text-sm">{user.display_name}</Text>
          <Text className="text-gray-400 text-xs">@{user.username}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onToggleFollow(user)}
        className={`flex-row items-center px-3 py-1.5 rounded-full border ${
          user.is_following
            ? 'bg-white border-gray-200'
            : 'bg-indigo-500 border-indigo-500'
        }`}
        activeOpacity={0.8}
      >
        {user.is_following ? (
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
    </View>
  );
}

export default function FriendsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [following, setFollowing] = useState<UserSearchResult[]>([]);
  const [followers, setFollowers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
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
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [query, activeTab]);

  async function loadFollowing() {
    setLoading(true);
    try { setFollowing(await listFollowing()); } catch { setFollowing([]); } finally { setLoading(false); }
  }

  async function loadFollowers() {
    setLoading(true);
    try { setFollowers(await listFollowers()); } catch { setFollowers([]); } finally { setLoading(false); }
  }

  // Reload lists when tab changes
  useEffect(() => {
    if (activeTab === 'following') loadFollowing();
    else if (activeTab === 'followers') loadFollowers();
  }, [activeTab]);

  // Reload when screen regains focus (e.g. user followed someone from search then switched tab)
  useFocusEffect(useCallback(() => {
    if (activeTab === 'following') loadFollowing();
    else if (activeTab === 'followers') loadFollowers();
  }, [activeTab]));

  async function handleToggleFollow(user: UserSearchResult) {
    // Optimistic update across all lists
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
      // Revert on error
      const revert = (list: UserSearchResult[]) =>
        list.map((u) => u.id === user.id ? { ...u, is_following: user.is_following } : u);
      setSearchResults((l) => revert(l));
      setFollowing((l) => revert(l));
      setFollowers((l) => revert(l));
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
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Tab bar */}
      <View className="flex-row border-b border-gray-100 bg-white">
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 items-center border-b-2 ${
              activeTab === tab.key ? 'border-indigo-500' : 'border-transparent'
            }`}
          >
            <Text className={`text-sm font-semibold ${
              activeTab === tab.key ? 'text-indigo-600' : 'text-gray-500'
            }`}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search input */}
      {activeTab === 'search' && (
        <View className="px-4 py-3 bg-white border-b border-gray-100">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by username or name…"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            className="bg-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-900"
          />
        </View>
      )}

      {/* List */}
      {loading && currentList.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" />
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
          ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-4" />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-16">
              <Text className="text-gray-400 text-sm">{emptyMessage}</Text>
            </View>
          }
          contentContainerStyle={currentList.length === 0 ? { flex: 1 } : undefined}
        />
      )}
    </SafeAreaView>
  );
}
