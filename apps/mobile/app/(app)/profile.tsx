import { useCallback, useEffect, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { RefreshCw, ChevronRight, Pencil, Sun, Moon, Smartphone, BarChart3 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fetchProfileStats } from '@/lib/zones';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore, type ThemeMode } from '@/stores/theme-store';
import { useTokens } from '@/lib/useTokens';
import { formatDistance, formatArea } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Eyebrow } from '@/components/brand/Eyebrow';

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

export default function ProfileScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { colors } = useTokens();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingColor, setUpdatingColor] = useState(false);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);

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

  useFocusEffect(useCallback(() => {
    loadProfile();
    loadStats();
  }, [userId]));

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View className="items-center mb-8">
          {!profileLoaded ? (
            <ActivityIndicator color={colors.accent} />
          ) : profile ? (
            <>
              <View className="mb-3">
                <Avatar
                  size={72}
                  displayName={profile.display_name}
                  color={profile.color}
                  avatarUrl={profile.avatar_url}
                  intent="territory"
                />
              </View>
              <Text variant="h2" tone="strong" align="center">{profile.display_name}</Text>
              <Text variant="caption" tone="subtle" style={{ marginBottom: 12, marginTop: 2 }}>@{profile.username}</Text>
              <TouchableOpacity
                onPress={() => router.push('/(app)/edit-profile' as never)}
                className="flex-row items-center bg-surfaceAlt px-4 py-2 rounded-pill border border-border"
                activeOpacity={0.7}
              >
                <Pencil size={14} color={colors.ink} />
                <Text variant="captionStrong" style={{ marginLeft: 6 }}>Edit profile</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text variant="caption" tone="subtle">Profile unavailable</Text>
          )}
        </View>

        {/* Zone stats */}
        <Card padding={20} elevation="whisper" style={{ marginBottom: 24 }}>
          <View className="flex-row items-center justify-between mb-4">
            <Eyebrow>Zone stats</Eyebrow>
            <TouchableOpacity onPress={handleRefresh} hitSlop={12}>
              <RefreshCw size={16} color={refreshing ? colors.inkSubtle : colors.accent} />
            </TouchableOpacity>
          </View>
          {stats ? (
            <View className="flex-row">
              <View className="flex-1 items-center">
                <Text variant="h1" tone="strong" style={{ fontSize: 36, lineHeight: 40 }}>
                  {formatDistance(stats.distance_walked_m)}
                </Text>
                <Eyebrow style={{ marginTop: 6 }}>Distance walked</Eyebrow>
              </View>
              <View style={{ width: 1, backgroundColor: colors.border }} />
              <View className="flex-1 items-center">
                <Text variant="h1" tone="strong" style={{ fontSize: 36, lineHeight: 40 }}>
                  {formatArea(stats.area_captured_m2)}
                </Text>
                <Eyebrow style={{ marginTop: 6 }}>Area captured</Eyebrow>
              </View>
            </View>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </Card>

        <TouchableOpacity
          onPress={() => router.push('/(app)/progress' as never)}
          activeOpacity={0.7}
          style={{ marginBottom: 24 }}
        >
          <Card padding={18} elevation="whisper">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BarChart3 size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text variant="bodyStrong" tone="strong">View progress</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  Weekly stats, streaks & goals
                </Text>
              </View>
              <ChevronRight size={18} color={colors.inkSubtle} />
            </View>
          </Card>
        </TouchableOpacity>

        {profile && (
          <Card padding={20} elevation="whisper" style={{ marginBottom: 24 }}>
            <Eyebrow bullet style={{ marginBottom: 16 }}>Territory color</Eyebrow>
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
                    borderColor: colors.inkStrong,
                    opacity: updatingColor && profile.color !== c ? 0.5 : 1,
                  }}
                >
                  {profile.color === c && (
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.surface }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        {/* Appearance */}
        <Card padding={20} elevation="whisper" style={{ marginBottom: 24 }}>
          <Eyebrow style={{ marginBottom: 16 }}>Appearance</Eyebrow>
          <View className="flex-row bg-surfaceAlt rounded-md p-1">
            {([
              { value: 'light',  label: 'Light',  Icon: Sun },
              { value: 'dark',   label: 'Dark',   Icon: Moon },
              { value: 'system', label: 'System', Icon: Smartphone },
            ] as { value: ThemeMode; label: string; Icon: typeof Sun }[]).map(({ value, label, Icon }) => {
              const active = themeMode === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setThemeMode(value)}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 10,
                    borderRadius: 6,
                    backgroundColor: active ? colors.surface : 'transparent',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: active ? 0.08 : 0,
                    shadowRadius: 2,
                    elevation: active ? 1 : 0,
                  }}
                >
                  <Icon size={16} color={active ? colors.accent : colors.inkMuted} />
                  <Text
                    variant="captionStrong"
                    style={{
                      marginLeft: 6,
                      color: active ? colors.accent : colors.inkMuted,
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Legal */}
        <Card elevation="whisper" style={{ marginBottom: 24, overflow: 'hidden' }}>
          {[
            { label: 'About',           path: '/(app)/legal/about'   as const },
            { label: 'Privacy Policy',  path: '/(app)/legal/privacy' as const },
            { label: 'Terms of Service', path: '/(app)/legal/terms'  as const },
          ].map((row, i, arr) => (
            <TouchableOpacity
              key={row.path}
              onPress={() => router.push(row.path)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
              activeOpacity={0.7}
            >
              <Text variant="bodyStrong">{row.label}</Text>
              <ChevronRight size={18} color={colors.inkSubtle} />
            </TouchableOpacity>
          ))}
        </Card>

        <View className="flex-1" />

        <TouchableOpacity
          className="border rounded-md py-3 items-center mb-4"
          style={{ borderColor: colors.danger }}
          onPress={() => signOut().catch(console.error)}
        >
          <Text variant="bodyStrong" tone="danger">Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
