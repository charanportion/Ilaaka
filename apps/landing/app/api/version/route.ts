import { NextResponse } from "next/server";
import { APK } from "@/lib/launch-phases";

export type VersionInfo = {
  /** Latest released Android version (semver). */
  latest: string;
  /**
   * Minimum version still allowed to run. If the installed app reports a
   * version below this, surface a hard "must update" prompt (no Later
   * button). Bump this only when older builds genuinely cannot function —
   * e.g. the server protocol changed.
   */
  minSupported: string;
  /** Where to send the user to download the new APK. */
  downloadUrl: string;
  /** ISO date string for display ("released 8 May 2026"). */
  releasedAt: string;
};

const SITE = "https://ilaaka.dotportion.com";

/* Tracks the lowest version we still consider compatible. Bump only when
   we ship a server change older binaries can't survive. Keeps the soft
   prompt path the default — most updates are nice-to-have, not mandatory. */
const MIN_SUPPORTED = "1.0.0";

export async function GET() {
  const body: VersionInfo = {
    latest: APK.version,
    minSupported: MIN_SUPPORTED,
    downloadUrl: `${SITE}/install`,
    releasedAt: APK.releasedAt,
  };
  return NextResponse.json(body, {
    headers: {
      /* CDN-cached for 5 minutes; safely stale up to 10. App polls on each
         cold start, so the cache absorbs the launch traffic spike when a
         release goes out. */
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
