import { useEffect, useState } from 'react';
import {
  View, TextInput, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Camera, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { showPermissionDenied } from '@/lib/permissions';
import { Avatar, PRESET_AVATARS } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { useTokens } from '@/lib/useTokens';
import { typography } from '@/lib/design-tokens';

type Profile = {
  username:     string;
  display_name: string;
  color:        string;
  avatar_url:   string | null;
};

const MIN_NAME = 2;
const MAX_NAME = 30;

export default function EditProfileScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { colors } = useTokens();
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [loading, setLoading]     = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username, display_name, color, avatar_url')
          .eq('id', userId)
          .single();
        if (data) {
          const p = data as Profile;
          setProfile(p);
          setDisplayName(p.display_name);
          setAvatarUrl(p.avatar_url);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  async function pickAndUploadPhoto() {
    if (!userId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showPermissionDenied('Photo library', 'upload a profile photo');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect:        [1, 1],
      quality:       0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setAvatarUrl(asset.uri);
    setUploading(true);
    try {
      const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase().split('?')[0];
      const path = `${userId}/${Date.now()}.${ext}`;
      const contentType = asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;

      const arrayBuffer = await fetch(asset.uri).then((r) => r.arrayBuffer());
      if (!arrayBuffer.byteLength) throw new Error('image read returned 0 bytes');

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { contentType, upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(`${pub.publicUrl}?v=${Date.now()}`);
    } catch (e: unknown) {
      console.error('[edit-profile] upload error:', e);
      setAvatarUrl(profile?.avatar_url ?? null);
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!userId || !profile) return;
    const trimmed = displayName.trim();
    if (trimmed.length < MIN_NAME) {
      Alert.alert('Name too short', `Use at least ${MIN_NAME} characters.`);
      return;
    }
    if (trimmed.length > MAX_NAME) {
      Alert.alert('Name too long', `Keep it under ${MAX_NAME} characters.`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: trimmed,
          avatar_url:   avatarUrl,
        })
        .eq('id', userId);
      if (error) throw error;
      router.back();
    } catch (e: unknown) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  const dirty =
    displayName.trim() !== profile.display_name ||
    avatarUrl          !== profile.avatar_url;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title:       'Edit profile',
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { fontFamily: typography.bodyStrong.fontFamily, color: colors.ink },
          headerShadowVisible: false,
          headerLeft:  () => (
            <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
              <ChevronLeft size={24} color={colors.ink} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={save} disabled={!dirty || saving} hitSlop={12}>
              <Text variant="captionStrong" style={{ color: dirty && !saving ? colors.accent : colors.inkSubtle }}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <View className="flex-1 bg-bg">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            {/* Avatar preview */}
            <View className="items-center mb-6">
              <Avatar
                size={96}
                displayName={displayName || profile.display_name}
                color={profile.color}
                avatarUrl={avatarUrl}
              />
              <Text variant="tag" tone="subtle" style={{ marginTop: 12 }}>@{profile.username}</Text>
            </View>

            {/* Display name */}
            <Card padding={16} elevation="whisper" style={{ marginBottom: 24 }}>
              <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase', marginBottom: 8 }}>
                Display name
              </Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={MAX_NAME}
                placeholder="Your name"
                placeholderTextColor={colors.inkSubtle}
                style={{
                  fontFamily: typography.body.fontFamily,
                  fontSize: typography.body.fontSize,
                  color: colors.ink,
                  paddingVertical: 4,
                }}
              />
            </Card>

            {/* Avatar picker */}
            <Card padding={16} elevation="whisper" style={{ marginBottom: 24 }}>
              <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase', marginBottom: 12 }}>
                Avatar
              </Text>

              <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                {/* Photo upload */}
                <TouchableOpacity
                  onPress={pickAndUploadPhoto}
                  disabled={uploading}
                  style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1, borderColor: colors.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  {uploading ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <Camera size={22} color={colors.accent} />
                  )}
                </TouchableOpacity>

                {/* Clear (back to initial) */}
                <TouchableOpacity
                  onPress={() => setAvatarUrl(null)}
                  style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1, borderColor: colors.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Trash2 size={20} color={colors.inkMuted} />
                </TouchableOpacity>

                {/* Preset emoji avatars */}
                {PRESET_AVATARS.map((emoji) => {
                  const presetUrl = `preset:${emoji}`;
                  const selected  = avatarUrl === presetUrl;
                  return (
                    <TouchableOpacity
                      key={emoji}
                      onPress={() => setAvatarUrl(presetUrl)}
                      activeOpacity={0.7}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: profile.color,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: selected ? 3 : 0,
                        borderColor: colors.inkStrong,
                      }}
                    >
                      <Text variant="body" style={{ fontSize: 28, lineHeight: 32 }}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text variant="tag" tone="subtle" style={{ marginTop: 12 }}>
                Upload your own photo or pick an emoji on your territory color.
              </Text>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}
