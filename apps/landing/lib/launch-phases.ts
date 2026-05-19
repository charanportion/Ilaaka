/**
 * Single source of truth for launch phase per platform + APK metadata.
 *
 * Android ships as a static asset in apps/landing/public/. The stable
 * public URL `/download.apk` 302-redirects to the actual versioned file
 * (see next.config.ts). Override with `NEXT_PUBLIC_APK_URL` to point at
 * a staging build hosted elsewhere.
 *
 * iOS flips from `pre_launch` → `app_store_live` once we ship to the
 * App Store. No other code change needed.
 */
export const LAUNCH = {
  ios: "pre_launch" as "pre_launch" | "app_store_live",
  region: "hyderabad_only" as "hyderabad_only" | "india_wide",
} as const;

export const APK_URL =
  process.env.NEXT_PUBLIC_APK_URL ?? "/download.apk";

export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL ?? "https://apps.apple.com/app/ilaaka";

/**
 * APK metadata shown on the /install page. Update these fields on every
 * new release alongside the file in public/. `releasedAt` is a freeform
 * date stamp; `sha256` is full hex (the install page renders the last 12).
 */
export const APK = {
  url: APK_URL,
  version: "1.0.2",
  sizeBytes: 60_927_467,
  sha256: "6d4342667151d991e720ec4420e58aa7cfb361054eb89ce5708f7aa5cfbbbc47",
  minAndroid: "10",
  releasedAt: "2026-05-19",
} as const;
