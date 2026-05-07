export type Platform = "ios" | "android" | "desktop" | "unknown";

/**
 * Server-safe UA-only detection. Used for the SSR'd render and as a base
 * for the client detection below. Note: iPadOS 13+ Safari pretends to be
 * a Mac in its UA, so this can mis-identify iPads — `detectPlatformClient`
 * corrects that using `navigator.maxTouchPoints`.
 */
export function detectPlatform(userAgent: string | null | undefined): Platform {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/macintosh|windows|linux/.test(ua)) return "desktop";
  return "unknown";
}

export function detectPlatformClient(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const base = detectPlatform(navigator.userAgent);

  /* iPad-on-Mac fix: iPadOS 13+ reports as Macintosh. A real Mac has
     maxTouchPoints === 0; an iPad reports >= 2. */
  if (base === "desktop") {
    const ua = navigator.userAgent.toLowerCase();
    const looksLikeMac = ua.includes("macintosh") || ua.includes("mac os");
    const isTouch =
      typeof navigator.maxTouchPoints === "number" &&
      navigator.maxTouchPoints > 1;
    if (looksLikeMac && isTouch) return "ios";
  }

  return base;
}
