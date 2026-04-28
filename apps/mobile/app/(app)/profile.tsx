import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { RefreshCw, ChevronRight, Pencil } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fetchProfileStats } from '@/lib/zones';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar } from '@/components/ui/Avatar';

const TERRITORY_COLORS = [
  '#E53935',
  '#FB8C00',
  '#FDD835',
  '#43A047',
  '#00897B',
  '#1E88E5',
  '#7F77DD',
  '#E91E63',
  '#8E24AA',
  '#00ACC1',
  '#C0CA33',
  '#6D4C41',
];

type Profile = {
  username: string;
  display_name: string;
  color: string;
  avatar_url: string | null;
};

type Stats = {
  distance_walked_m: number;
  area_captured_m2: number;
};

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

function formatArea(m2: number): string {
  if (m2 < 10_000) return `${m2.toLocaleString()} m²`;
  return `${(m2 / 10_000).toFixed(2)} ha`;
}

export default function ProfileScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingColor, setUpdatingColor] = useState(false);

  async function loadStats() {
    if (!userId) return;
    try {
      const fresh = await fetchProfileStats(userId);
      setStats(fresh);
    } catch (e) {
      console.error('[profile] stats error:', e);
      setStats({ distance_walked_m: 0, area_captured_m2: 0 });
    }
  }

  async function updateColor(color: string) {
    if (!userId || !profile) return;
    setProfile({ ...profile, color });
    setUpdatingColor(true);
    const { error } = await supabase.from('profiles').update({ color }).eq('id', userId);
    if (error) {
      console.error('[profile] color update error:', error);
      const { data } = await supabase.from('profiles').select('username, display_name, color, avatar_url').eq('id', userId).single();
      if (data) setProfile(data as Profile);
    }
    setUpdatingColor(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }

  async function loadProfile() {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('username, display_name, color, avatar_url')
        .eq('id', userId)
        .single();
      setProfile(data as Profile | null);
    } catch (e) {
      console.error('[profile] fetch error:', e);
      setProfile(null);
    } finally {
      setProfileLoaded(true);
    }
  }

  useEffect(() => { loadProfile(); }, [userId]);

  // Refetch profile + stats every time the tab regains focus so edits land instantly.
  useFocusEffect(useCallback(() => {
    loadProfile();
    loadStats();
  }, [userId]));

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366F1" />}
      >
        {/* Header */}
        <View className="items-center mb-8">
          {!profileLoaded ? (
            <ActivityIndicator color="#6366F1" />
          ) : profile ? (
            <>
              <View className="mb-3">
                <Avatar
                  size={72}
                  displayName={profile.display_name}
                  color={profile.color}
                  avatarUrl={profile.avatar_url}
                />
              </View>
              <Text className="text-xl font-bold text-gray-900">{profile.display_name}</Text>
              <Text className="text-sm text-gray-400 mb-3">@{profile.username}</Text>
              <TouchableOpacity
                onPress={() => router.push('/(app)/edit-profile' as never)}
                className="flex-row items-center bg-gray-100 px-4 py-2 rounded-full"
                activeOpacity={0.7}
              >
                <Pencil size={14} color="#374151" />
                <Text className="text-gray-700 text-sm font-semibold ml-1.5">Edit profile</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text className="text-gray-400 text-sm">Profile unavailable</Text>
          )}
        </View>

        {/* Zone stats */}
        <View className="bg-white rounded-2xl p-5 mb-6 shadow-sm">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Zone stats
            </Text>
            <TouchableOpacity onPress={handleRefresh} hitSlop={12}>
              <RefreshCw size={16} color={refreshing ? '#9CA3AF' : '#6366F1'} />
            </TouchableOpacity>
          </View>
          {stats ? (
            <View className="flex-row">
              <View className="flex-1 items-center">
                <Text className="text-2xl font-bold text-indigo-600">{formatDistance(stats.distance_walked_m)}</Text>
                <Text className="text-xs text-gray-500 mt-1">Distance walked</Text>
              </View>
              <View className="w-px bg-gray-100" />
              <View className="flex-1 items-center">
                <Text className="text-2xl font-bold text-indigo-600">{formatArea(stats.area_captured_m2)}</Text>
                <Text className="text-xs text-gray-500 mt-1">Area captured</Text>
              </View>
            </View>
          ) : (
            <ActivityIndicator color="#6366F1" />
          )}
        </View>

        {profile && (
          <View className="bg-white rounded-2xl p-5 mb-6 shadow-sm">
            <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Territory Color
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {TERRITORY_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => updateColor(c)}
                  disabled={updatingColor}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: c,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: profile.color === c ? 3 : 0,
                    borderColor: '#111827',
                    opacity: updatingColor && profile.color !== c ? 0.5 : 1,
                  }}
                >
                  {profile.color === c && (
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Legal */}
        <View className="bg-white rounded-2xl mb-6 shadow-sm overflow-hidden">
          {[
            { label: 'About',           path: '/(app)/legal/about'   as const },
            { label: 'Privacy Policy',  path: '/(app)/legal/privacy' as const },
            { label: 'Terms of Service', path: '/(app)/legal/terms'  as const },
          ].map((row, i, arr) => (
            <TouchableOpacity
              key={row.path}
              onPress={() => router.push(row.path)}
              className={`flex-row items-center justify-between px-5 py-4 ${
                i < arr.length - 1 ? 'border-b border-gray-100' : ''
              }`}
              activeOpacity={0.7}
            >
              <Text className="text-sm text-gray-700 font-medium">{row.label}</Text>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        <View className="flex-1" />

        <TouchableOpacity
          className="border border-red-300 rounded-xl py-3 items-center mb-4"
          onPress={() => signOut().catch(console.error)}
        >
          <Text className="text-red-500 font-semibold">Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
