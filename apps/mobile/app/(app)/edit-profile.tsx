import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Camera, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar, PRESET_AVATARS } from '@/components/ui/Avatar';

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
      Alert.alert('Permission needed', 'Allow photo library access to upload a photo.');
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

    // Show the cropped image immediately as preview while we upload in the background.
    setAvatarUrl(asset.uri);
    setUploading(true);
    try {
      const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase().split('?')[0];
      const path = `${userId}/${Date.now()}.${ext}`;
      const contentType = asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;

      // RN-friendly: read the cropped file once as ArrayBuffer.
      const arrayBuffer = await fetch(asset.uri).then((r) => r.arrayBuffer());
      if (!arrayBuffer.byteLength) throw new Error('image read returned 0 bytes');

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { contentType, upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      // Cache-bust so the CDN won't serve a stale image at this path.
      setAvatarUrl(`${pub.publicUrl}?v=${Date.now()}`);
    } catch (e: unknown) {
      console.error('[edit-profile] upload error:', e);
      // Roll back preview to whatever was saved before so we don't claim a successful upload.
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
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
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
          headerLeft:  () => (
            <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
              <ChevronLeft size={24} color="#111827" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={save} disabled={!dirty || saving} hitSlop={12}>
              <Text className={`text-sm font-semibold ${dirty && !saving ? 'text-indigo-600' : 'text-gray-300'}`}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
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
              <Text className="text-xs text-gray-400 mt-3">@{profile.username}</Text>
            </View>

            {/* Display name */}
            <View className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Display name
              </Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={MAX_NAME}
                placeholder="Your name"
                placeholderTextColor="#9CA3AF"
                className="text-base text-gray-900 py-1"
              />
            </View>

            {/* Avatar picker */}
            <View className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Avatar
              </Text>

              <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                {/* Photo upload */}
                <TouchableOpacity
                  onPress={pickAndUploadPhoto}
                  disabled={uploading}
                  className="w-14 h-14 rounded-full bg-indigo-100 items-center justify-center"
                  activeOpacity={0.7}
                >
                  {uploading ? (
                    <ActivityIndicator color="#6366F1" />
                  ) : (
                    <Camera size={22} color="#6366F1" />
                  )}
                </TouchableOpacity>

                {/* Clear (back to initial) */}
                <TouchableOpacity
                  onPress={() => setAvatarUrl(null)}
                  className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center"
                  activeOpacity={0.7}
                >
                  <Trash2 size={20} color="#6B7280" />
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
                        borderColor: '#111827',
                      }}
                    >
                      <Text style={{ fontSize: 28 }}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text className="text-xs text-gray-400 mt-3">
                Upload your own photo or pick an emoji on your territory color.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
