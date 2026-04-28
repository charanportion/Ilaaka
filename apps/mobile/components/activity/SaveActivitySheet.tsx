import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, Switch, Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, X, Globe, Users, Lock } from 'lucide-react-native';
import { uploadActivityPhotoDraft, deleteDraftPhoto } from '@/lib/storage';
import { estimateCalories } from '@/lib/calories';
import type { ActivityMetadata, ActivityType, ActivityVisibility } from '@/types/api';

const MAX_PHOTOS = 5;
const MAX_TITLE = 80;
const MAX_DESC = 2000;

type Props = {
  userId:    string;
  localId:   string;
  type:      ActivityType;
  startedAt: Date;
  distanceM: number;
  durationS: number;
  onPublish: (metadata: ActivityMetadata) => Promise<void> | void;
  onDiscard: () => void;
  publishing: boolean;
};

function autoTitle(type: ActivityType, startedAt: Date): string {
  const verb = type === 'run' ? 'Run' : type === 'walk' ? 'Walk' : type === 'cycle' ? 'Ride' : 'Hike';
  const h = startedAt.getHours();
  const tod = h < 5 ? 'Late night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  return `${tod} ${verb}`;
}

function VisibilityOption({
  current, value, label, icon, onSelect,
}: {
  current: ActivityVisibility;
  value:   ActivityVisibility;
  label:   string;
  icon:    React.ReactNode;
  onSelect: (v: ActivityVisibility) => void;
}) {
  const selected = current === value;
  return (
    <TouchableOpacity
      onPress={() => onSelect(value)}
      activeOpacity={0.7}
      className={`flex-row items-center px-4 py-3 rounded-2xl mb-2 ${
        selected ? 'bg-indigo-500' : 'bg-gray-100'
      }`}
    >
      <View className="mr-3">{icon}</View>
      <Text className={`flex-1 text-sm font-semibold ${selected ? 'text-white' : 'text-gray-900'}`}>
        {label}
      </Text>
      {selected && (
        <View className="w-5 h-5 rounded-full bg-white items-center justify-center">
          <View className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
        </View>
      )}
    </TouchableOpacity>
  );
}

export function SaveActivitySheet({
  userId, localId, type, startedAt, distanceM, durationS,
  onPublish, onDiscard, publishing,
}: Props) {
  const [title, setTitle]                 = useState('');
  const [description, setDescription]     = useState('');
  const [visibility, setVisibility]       = useState<ActivityVisibility>('public');
  const [hidePace, setHidePace]           = useState(false);
  const [hideCalories, setHideCalories]   = useState(false);
  const [photos, setPhotos]               = useState<{ path: string; uri: string }[]>([]);
  const [uploading, setUploading]         = useState(false);

  const placeholder = autoTitle(type, startedAt);
  const calories    = estimateCalories(type, durationS);

  async function pickPhoto() {
    if (photos.length >= MAX_PHOTOS || uploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to add photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality:       0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setUploading(true);
    const position = photos.length;
    try {
      const path = await uploadActivityPhotoDraft({
        userId,
        localActivityId: localId,
        position,
        fileUri:         asset.uri,
        mimeType:        asset.mimeType,
      });
      setPhotos((p) => [...p, { path, uri: asset.uri }]);
    } catch (e) {
      console.error('[save-activity] upload error:', e);
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(idx: number) {
    const removed = photos[idx];
    setPhotos((p) => p.filter((_, i) => i !== idx));
    deleteDraftPhoto(removed.path);
  }

  async function handlePublish() {
    const metadata: ActivityMetadata = {
      title:         title.trim().length > 0 ? title.trim() : undefined,
      description:   description.trim().length > 0 ? description.trim() : undefined,
      visibility,
      hide_pace:     hidePace,
      hide_calories: hideCalories,
      photo_paths:   photos.map((p) => p.path),
    };
    await onPublish(metadata);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-gray-50"
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Quick stats summary */}
        <View className="bg-white rounded-2xl p-4 mb-4 flex-row">
          <View className="flex-1 items-center">
            <Text className="text-xl font-bold text-indigo-600">{(distanceM / 1000).toFixed(2)}</Text>
            <Text className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">km</Text>
          </View>
          <View className="w-px bg-gray-100" />
          <View className="flex-1 items-center">
            <Text className="text-xl font-bold text-indigo-600">{Math.floor(durationS / 60)}</Text>
            <Text className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">min</Text>
          </View>
          <View className="w-px bg-gray-100" />
          <View className="flex-1 items-center">
            <Text className="text-xl font-bold text-indigo-600">{calories}</Text>
            <Text className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">kcal</Text>
          </View>
        </View>

        {/* Title */}
        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            maxLength={MAX_TITLE}
            className="text-base text-gray-900"
          />
        </View>

        {/* Description */}
        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="How did it go?"
            placeholderTextColor="#9CA3AF"
            maxLength={MAX_DESC}
            multiline
            className="text-base text-gray-900"
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
        </View>

        {/* Photos */}
        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Photos ({photos.length}/{MAX_PHOTOS})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable
              onPress={pickPhoto}
              disabled={photos.length >= MAX_PHOTOS || uploading}
              className={`w-20 h-20 mr-3 rounded-xl items-center justify-center ${
                photos.length >= MAX_PHOTOS ? 'bg-gray-100' : 'bg-indigo-50'
              }`}
            >
              {uploading
                ? <ActivityIndicator color="#6366F1" />
                : <Camera size={24} color={photos.length >= MAX_PHOTOS ? '#9CA3AF' : '#6366F1'} />}
            </Pressable>
            {photos.map((photo, i) => (
              <View key={photo.path} className="mr-3">
                <Image source={{ uri: photo.uri }} style={{ width: 80, height: 80, borderRadius: 12 }} />
                <TouchableOpacity
                  onPress={() => removePhoto(i)}
                  className="absolute -top-1.5 -right-1.5 bg-gray-900 rounded-full p-1"
                  hitSlop={6}
                >
                  <X size={12} color="white" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Visibility */}
        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Visibility</Text>
          <VisibilityOption
            current={visibility} value="public"
            label="Everyone"
            icon={<Globe size={18} color={visibility === 'public' ? 'white' : '#6B7280'} />}
            onSelect={setVisibility}
          />
          <VisibilityOption
            current={visibility} value="followers"
            label="Followers only"
            icon={<Users size={18} color={visibility === 'followers' ? 'white' : '#6B7280'} />}
            onSelect={setVisibility}
          />
          <VisibilityOption
            current={visibility} value="private"
            label="Only you"
            icon={<Lock size={18} color={visibility === 'private' ? 'white' : '#6B7280'} />}
            onSelect={setVisibility}
          />
        </View>

        {/* Hidden details */}
        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Hide details</Text>

          <View className="flex-row items-center justify-between py-2">
            <View className="flex-1">
              <Text className="text-sm text-gray-900 font-medium">Hide pace</Text>
              <Text className="text-xs text-gray-400 mt-0.5">Other people won&apos;t see your pace</Text>
            </View>
            <Switch
              value={hidePace}
              onValueChange={setHidePace}
              trackColor={{ false: '#E5E7EB', true: '#A5B4FC' }}
              thumbColor={hidePace ? '#6366F1' : '#FFFFFF'}
            />
          </View>

          <View className="h-px bg-gray-100 my-1" />

          <View className="flex-row items-center justify-between py-2">
            <View className="flex-1">
              <Text className="text-sm text-gray-900 font-medium">Hide calories</Text>
              <Text className="text-xs text-gray-400 mt-0.5">Other people won&apos;t see your calorie estimate</Text>
            </View>
            <Switch
              value={hideCalories}
              onValueChange={setHideCalories}
              trackColor={{ false: '#E5E7EB', true: '#A5B4FC' }}
              thumbColor={hideCalories ? '#6366F1' : '#FFFFFF'}
            />
          </View>
        </View>
      </ScrollView>

      {/* Sticky publish bar */}
      <View
        className="bg-white border-t border-gray-200 px-4 py-3"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
      >
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={onDiscard}
            disabled={publishing}
            className="flex-1 bg-gray-100 rounded-2xl py-4 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-gray-600 font-semibold text-base">Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePublish}
            disabled={publishing || uploading}
            className={`flex-1 rounded-2xl py-4 items-center ${
              publishing || uploading ? 'bg-indigo-300' : 'bg-indigo-500'
            }`}
            activeOpacity={0.8}
          >
            {publishing ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Publish</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
