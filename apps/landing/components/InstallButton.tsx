"use client";

import { useEffect, useState } from "react";
import { detectPlatformClient, type Platform } from "@/lib/platform-detect";
import { LAUNCH, APK_URL, APP_STORE_URL } from "@/lib/launch-phases";
import { track } from "@/lib/analytics";

type Props = {
  /** where this button lives, for analytics */
  location: "hero" | "sticky" | "founder" | "footer";
  size?: "lg" | "md";
  onOpenWaitlist: (context: "ios_waitlist") => void;
  onOpenQr: () => void;
  className?: string;
};

export function InstallButton({
  location,
  size = "lg",
  onOpenWaitlist,
  onOpenQr,
  className,
}: Props) {
  const [platform, setPlatform] = useState<Platform>("unknown");
  useEffect(() => setPlatform(detectPlatformClient()), []);

  const sizing =
    size === "lg" ? "px-7 py-5 text-[1.05rem]" : "px-5 py-3.5 text-[0.95rem]";

  /* The label stays uniform on every mobile device — "Get the app" — so
     touch users never see "Scan to install". Click-time logic decides
     whether to open the store, the iOS waitlist, or the desktop QR. */
  const label = platform === "desktop" ? "Scan to install" : "Get the app";

  const PlatformIcon =
    platform === "ios"
      ? AppleIcon
      : platform === "desktop"
        ? QrIcon
        : DownloadIcon;

  function handleClick() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(8);
      } catch {
        /* noop */
      }
    }
    /* Re-detect at click time — covers the edge case where the user taps
       before the post-mount effect has run (and lets the iPad-on-Mac
       fix apply even if the SSR'd state was wrong). */
    const live = detectPlatformClient();
    track("install_button_clicked", { platform: live, button_location: location });

    if (live === "android") {
      /* Direct APK download — no Play Store yet. The browser handles the
         install prompt; users may need "Install unknown apps" enabled. */
      const a = document.createElement("a");
      a.href = APK_URL;
      a.download = "ilaaka.apk";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    if (live === "ios" && LAUNCH.ios === "app_store_live") {
      window.location.href = APP_STORE_URL;
      return;
    }
    if (live === "ios") {
      onOpenWaitlist("ios_waitlist");
      return;
    }
    /* Desktop / unknown — show the QR so they can install on their phone.
       Scanning leads them to the same APK download. */
    onOpenQr();
  }

  return (
    <button
      onClick={handleClick}
      className={`btn-pill btn-primary group ${sizing} ${className ?? ""}`}
      aria-label={label}
    >
      <PlatformIcon className="w-5 h-5 -ml-0.5 transition-transform duration-300 group-hover:rotate-[-6deg]" />
      <span>{label}</span>
      <span aria-hidden className="font-mono text-[0.7em] opacity-70 ml-1.5">
        →
      </span>
    </button>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  /* Generic fallback used during SSR / when platform detection hasn't
     completed yet — keeps the button looking like a download button
     instead of flashing a QR icon on mobile. */
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4 V16" />
      <path d="M6 11 L12 17 L18 11" />
      <path d="M5 21 H19" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M16.4 12.6c0-2.7 2.2-4 2.3-4-1.2-1.8-3.2-2-3.9-2.1-1.6-.2-3.3.9-4.1.9-.9 0-2.2-.9-3.7-.9-1.9 0-3.7 1.1-4.6 2.8-2 3.4-.5 8.4 1.4 11.2.9 1.3 2 2.8 3.4 2.8 1.4-.1 1.9-.9 3.6-.9 1.7 0 2.1.9 3.6.9 1.5 0 2.5-1.4 3.4-2.7 1.1-1.6 1.5-3.1 1.6-3.2-.1 0-3-1.2-3-4.8ZM13.7 4.6c.7-.9 1.3-2.2 1.1-3.5-1.1.1-2.4.7-3.2 1.6-.7.8-1.4 2.1-1.2 3.4 1.2.1 2.5-.6 3.3-1.5Z" />
    </svg>
  );
}

function QrIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3M21 14v3M14 17v4M17 21h4" />
    </svg>
  );
}
