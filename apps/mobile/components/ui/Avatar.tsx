import { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { typography } from '@/lib/design-tokens';

// avatar_url encodes one of three things:
//   null / undefined  → render the colored initial circle
//   "preset:🏃"        → render that emoji on a colored background
//   "https://..."     → render the image from URL (uploaded photo)
export function isPresetAvatar(avatarUrl: string | null | undefined): boolean {
  return typeof avatarUrl === 'string' && avatarUrl.startsWith('preset:');
}

export function presetEmoji(avatarUrl: string): string {
  return avatarUrl.slice('preset:'.length);
}

export const PRESET_AVATARS = [
  '🏃', '🚶', '🚴', '🥾',
  '🏔️', '🌳', '🌊', '🔥',
  '⭐', '🎯', '🗺️', '🧭',
] as const;

type Props = {
  size?: number;
  displayName: string;
  color: string;
  avatarUrl: string | null | undefined;
};

export function Avatar({ size = 40, displayName, color, avatarUrl }: Props) {
  const radius   = size / 2;
  const fontSize = Math.round(size * 0.42);
  const emojiSize = Math.round(size * 0.55);
  const [imageFailed, setImageFailed] = useState(false);

  // Photo upload — fall through to the initials/preset placeholder on load error
  // so a dead URL doesn't leave a blank circle.
  if (avatarUrl && !isPresetAvatar(avatarUrl) && !imageFailed) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        onError={() => setImageFailed(true)}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: color }}
      />
    );
  }

  // Preset emoji
  if (avatarUrl && isPresetAvatar(avatarUrl)) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: emojiSize }}>{presetEmoji(avatarUrl)}</Text>
      </View>
    );
  }

  // Initial fallback
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#ffffff', fontFamily: typography.bodyStrong.fontFamily, fontSize }}>
        {displayName.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
