import type { NextConfig } from "next";

/**
 * The Android APK ships as a static asset under apps/landing/public/.
 * `/download.apk` is the stable public URL (shareable, bookmarkable,
 * survives version bumps). Per-release flow:
 *
 *   1. Drop the new APK into apps/landing/public/ as ilaaka_vX.Y.Z.apk
 *   2. Bump APK_FILENAME below to match
 *   3. Update version / sizeBytes / sha256 in lib/launch-phases.ts
 *   4. Commit + redeploy
 */
const APK_FILENAME = "ilaaka_v1.0.2.apk";
const APK_RELEASE_URL = `/${APK_FILENAME}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["motion"],
  },
  async redirects() {
    return [
      {
        source: "/download.apk",
        destination: APK_RELEASE_URL,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
