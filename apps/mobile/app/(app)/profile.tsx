import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fetchProfileStats } from '@/lib/zones';
import { useAuthStore } from '@/stores/auth-store';

type Profile = {
  username: string;
  display_name: string;
  color: string;
};

type Stats = {
  cells_owned: number;
  cells_captured_alltime: number;
};

export default function ProfileScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!userId) return;

    supabase
      .from('profiles')
      .select('username, display_name, color')
      .eq('id', userId)
      .single()
      .then(({ data }) => setProfile(data as Profile | null))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoaded(true));

    fetchProfileStats(userId)
      .then(setStats)
      .catch(() => setStats({ cells_owned: 0, cells_captured_alltime: 0 }));
  }, [userId]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 px-6 pt-8">

        {/* Header */}
        <View className="items-center mb-8">
          {!profileLoaded ? (
            <ActivityIndicator color="#6366F1" />
          ) : profile ? (
            <>
              <View
                className="w-16 h-16 rounded-full mb-3 items-center justify-center"
                style={{ backgroundColor: profile.color }}
              >
                <Text className="text-white text-2xl font-bold">
                  {profile.display_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="text-xl font-bold text-gray-900">{profile.display_name}</Text>
              <Text className="text-sm text-gray-400">@{profile.username}</Text>
            </>
          ) : (
            <Text className="text-gray-400 text-sm">Profile unavailable</Text>
          )}
        </View>

        {/* Zone stats */}
        <View className="bg-white rounded-2xl p-5 mb-6 shadow-sm">
          <Text className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">
            Zone stats
          </Text>
          {stats ? (
            <View className="flex-row">
              <View className="flex-1 items-center">
                <Text className="text-3xl font-bold text-indigo-600">{stats.cells_owned}</Text>
                <Text className="text-xs text-gray-500 mt-1">Hexes owned</Text>
              </View>
              <View className="w-px bg-gray-100" />
              <View className="flex-1 items-center">
                <Text className="text-3xl font-bold text-indigo-600">{stats.cells_captured_alltime}</Text>
                <Text className="text-xs text-gray-500 mt-1">Captured all-time</Text>
              </View>
            </View>
          ) : (
            <ActivityIndicator color="#6366F1" />
          )}
        </View>

        <View className="flex-1" />

        <TouchableOpacity
          className="border border-red-300 rounded-xl py-3 items-center mb-4"
          onPress={() => signOut().catch(console.error)}
        >
          <Text className="text-red-500 font-semibold">Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
