import { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, ScrollView, Image, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, Switch, Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, X, Globe, Users, Lock } from 'lucide-react-native';
import { uploadActivityPhotoDraft, deleteDraftPhoto } from '@/lib/storage';
import { showPermissionDenied } from '@/lib/permissions';
import { estimateCalories } from '@/lib/calories';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTokens } from '@/lib/useTokens';
import { typography } from '@/lib/design-tokens';
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
  const { colors } = useTokens();
  const selected = current === value;
  return (
    <TouchableOpacity
      onPress={() => onSelect(value)}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: selected ? colors.ctaBg : colors.surfaceAlt,
      }}
    >
      <View style={{ marginRight: 12 }}>{icon}</View>
      <Text
        variant="bodyStrong"
        style={{ flex: 1, color: selected ? colors.ctaFg : colors.ink }}
      >
        {label}
      </Text>
      {selected && (
        <View
          style={{
            width: 20, height: 20, borderRadius: 10,
            backgroundColor: colors.ctaFg,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: colors.ctaBg,
            }}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

export function SaveActivitySheet({
  userId, localId, type, startedAt, distanceM, durationS,
  onPublish, onDiscard, publishing,
}: Props) {
  const { colors } = useTokens();
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
      showPermissionDenied('Photo library', 'add photos to your activity');
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
      className="flex-1 bg-bg"
    >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {/* Quick stats summary */}
        <Card padding={16} elevation="whisper" style={{ marginBottom: 16, flexDirection: 'row' }}>
          <View className="flex-1 items-center">
            <Text variant="h3" style={{ color: colors.accent }}>{(distanceM / 1000).toFixed(2)}</Text>
            <Text variant="tag" tone="muted" style={{ marginTop: 4, textTransform: 'uppercase' }}>km</Text>
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View className="flex-1 items-center">
            <Text variant="h3" style={{ color: colors.accent }}>{Math.floor(durationS / 60)}</Text>
            <Text variant="tag" tone="muted" style={{ marginTop: 4, textTransform: 'uppercase' }}>min</Text>
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View className="flex-1 items-center">
            <Text variant="h3" style={{ color: colors.accent }}>{calories}</Text>
            <Text variant="tag" tone="muted" style={{ marginTop: 4, textTransform: 'uppercase' }}>kcal</Text>
          </View>
        </Card>

        {/* Title */}
        <Card padding={16} elevation="whisper" style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase' }}>Title</Text>
            <Text variant="tag" tone={title.length >= MAX_TITLE ? 'warning' : 'subtle'}>
              {title.length}/{MAX_TITLE}
            </Text>
          </View>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={placeholder}
            placeholderTextColor={colors.inkSubtle}
            maxLength={MAX_TITLE}
            style={{
              fontFamily: typography.body.fontFamily,
              fontSize: typography.body.fontSize,
              color: colors.ink,
            }}
          />
        </Card>

        {/* Description */}
        <Card padding={16} elevation="whisper" style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase' }}>Description</Text>
            <Text variant="tag" tone={description.length >= MAX_DESC ? 'warning' : 'subtle'}>
              {description.length}/{MAX_DESC}
            </Text>
          </View>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="How did it go?"
            placeholderTextColor={colors.inkSubtle}
            maxLength={MAX_DESC}
            multiline
            style={{
              fontFamily: typography.body.fontFamily,
              fontSize: typography.body.fontSize,
              color: colors.ink,
              minHeight: 80,
              textAlignVertical: 'top',
            }}
          />
        </Card>

        {/* Photos */}
        <Card padding={16} elevation="whisper" style={{ marginBottom: 16 }}>
          <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase', marginBottom: 12 }}>
            Photos ({photos.length}/{MAX_PHOTOS})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable
              onPress={pickPhoto}
              disabled={photos.length >= MAX_PHOTOS || uploading}
              style={{
                width: 80, height: 80, marginRight: 12, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: photos.length >= MAX_PHOTOS ? colors.surfaceAlt : colors.surfaceAlt,
                borderWidth: 1, borderColor: colors.border,
              }}
            >
              {uploading
                ? <ActivityIndicator color={colors.accent} />
                : <Camera size={24} color={photos.length >= MAX_PHOTOS ? colors.inkSubtle : colors.accent} />}
            </Pressable>
            {photos.map((photo, i) => (
              <View key={photo.path} style={{ marginRight: 12 }}>
                <Image source={{ uri: photo.uri }} style={{ width: 80, height: 80, borderRadius: 16 }} />
                <TouchableOpacity
                  onPress={() => removePhoto(i)}
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    backgroundColor: colors.inkStrong, borderRadius: 9999, padding: 4,
                  }}
                  hitSlop={6}
                >
                  <X size={12} color={colors.surface} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </Card>

        {/* Visibility */}
        <Card padding={16} elevation="whisper" style={{ marginBottom: 16 }}>
          <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase', marginBottom: 12 }}>Visibility</Text>
          <VisibilityOption
            current={visibility} value="public"
            label="Everyone"
            icon={<Globe size={18} color={visibility === 'public' ? colors.ctaFg : colors.inkMuted} />}
            onSelect={setVisibility}
          />
          <VisibilityOption
            current={visibility} value="followers"
            label="Followers only"
            icon={<Users size={18} color={visibility === 'followers' ? colors.ctaFg : colors.inkMuted} />}
            onSelect={setVisibility}
          />
          <VisibilityOption
            current={visibility} value="private"
            label="Only you"
            icon={<Lock size={18} color={visibility === 'private' ? colors.ctaFg : colors.inkMuted} />}
            onSelect={setVisibility}
          />
        </Card>

        {/* Hidden details */}
        <Card padding={16} elevation="whisper" style={{ marginBottom: 16 }}>
          <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase', marginBottom: 12 }}>Hide details</Text>

          <View className="flex-row items-center justify-between py-2">
            <View className="flex-1">
              <Text variant="bodyStrong">Hide pace</Text>
              <Text variant="tag" tone="subtle" style={{ marginTop: 2 }}>Other people won&apos;t see your pace</Text>
            </View>
            <Switch
              value={hidePace}
              onValueChange={setHidePace}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

          <View className="flex-row items-center justify-between py-2">
            <View className="flex-1">
              <Text variant="bodyStrong">Hide calories</Text>
              <Text variant="tag" tone="subtle" style={{ marginTop: 2 }}>Other people won&apos;t see your calorie estimate</Text>
            </View>
            <Switch
              value={hideCalories}
              onValueChange={setHideCalories}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surface}
            />
          </View>
        </Card>
      </ScrollView>

      {/* Publish bar — docked at the bottom via flex, sits above the tab bar */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopWidth: 1, borderTopColor: colors.border,
          paddingHorizontal: 16, paddingVertical: 12,
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          <Button
            label="Discard"
            variant="secondary"
            size="lg"
            onPress={onDiscard}
            disabled={publishing}
            style={{ flex: 1, marginRight: 6 }}
          />
          <Button
            label="Publish"
            variant="primary"
            size="lg"
            onPress={handlePublish}
            loading={publishing}
            disabled={publishing || uploading}
            style={{ flex: 1, marginLeft: 6 }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
