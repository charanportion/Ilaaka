import { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { typography } from '@/lib/design-tokens';
import { useTokens } from '@/lib/useTokens';

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

/**
 * Avatar `intent` controls whether the user's territorial color shows.
 *
 * - `territory` — keeps `color` as the avatar background. Use in
 *   territory-adjacent surfaces: ZoneInfoCard, feed ActivityCard,
 *   activity detail, leaderboards.
 * - `chrome` — renders monochrome (surfaceAlt bg + ink initials).
 *   Use in pure UI chrome: settings rows, comments, replies, search
 *   results — anywhere the user's color isn't representing a zone.
 */
export type AvatarIntent = 'territory' | 'chrome';

type Props = {
  size?: number;
  displayName: string;
  color: string;
  avatarUrl: string | null | undefined;
  intent?: AvatarIntent;
};

export function Avatar({
  size = 40,
  displayName,
  color,
  avatarUrl,
  intent = 'chrome',
}: Props) {
  const { colors } = useTokens();
  const radius   = size / 2;
  const fontSize = Math.round(size * 0.42);
  const emojiSize = Math.round(size * 0.55);
  const [imageFailed, setImageFailed] = useState(false);

  /* Background colour resolution: territory intent shows the user's
     server-assigned color; chrome intent uses a neutral surface so
     the avatar reads as a UI element, not a territory marker. */
  const bg = intent === 'territory' ? color : colors.surfaceAlt;
  const fg = intent === 'territory' ? '#ffffff' : colors.ink;

  // Photo upload — fall through to the initials/preset placeholder on load error
  // so a dead URL doesn't leave a blank circle.
  if (avatarUrl && !isPresetAvatar(avatarUrl) && !imageFailed) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        onError={() => setImageFailed(true)}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg }}
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
          backgroundColor: bg,
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
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: fg, fontFamily: typography.bodyStrong.fontFamily, fontSize }}>
        {displayName.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
