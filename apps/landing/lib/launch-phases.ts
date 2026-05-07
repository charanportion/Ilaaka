/**
 * Single source of truth for launch phase per platform.
 *
 * Android is distributed as a direct APK download (not Play Store) for v0.
 * Drop `ilaaka.apk` into `public/` or set `NEXT_PUBLIC_APK_URL` to a CDN.
 *
 * iOS flips from `pre_launch` → `app_store_live` once we ship to the
 * App Store. No other code change needed.
 */
export const LAUNCH = {
  ios: "pre_launch" as "pre_launch" | "app_store_live",
  region: "hyderabad_only" as "hyderabad_only" | "india_wide",
} as const;

export const APK_URL = process.env.NEXT_PUBLIC_APK_URL ?? "/ilaaka.apk";
export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL ?? "https://apps.apple.com/app/ilaaka";
