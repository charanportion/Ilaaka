"use client";

import { useEffect, useRef, useState } from "react";
import { detectPlatformClient, type Platform } from "@/lib/platform-detect";
import { APK } from "@/lib/launch-phases";
import { track } from "@/lib/analytics";
import { QrCode } from "@/components/install/QrCode";

type ConnectionType = "slow-2g" | "2g" | "3g" | "4g" | "unknown";

type NetworkInformation = {
  effectiveType?: ConnectionType;
  saveData?: boolean;
};

const SLOW_TYPES: ConnectionType[] = ["slow-2g", "2g", "3g"];
const INSTALL_URL = "https://ilaaka.dotportion.com/install";

function readNetwork(): { effectiveType: ConnectionType; saveData: boolean } {
  if (typeof navigator === "undefined") {
    return { effectiveType: "unknown", saveData: false };
  }
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return {
    effectiveType: conn?.effectiveType ?? "unknown",
    saveData: Boolean(conn?.saveData),
  };
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function shortSha(sha: string): string {
  return sha.slice(-12);
}

export function AutoDownload() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [showSlow, setShowSlow] = useState(false);
  const [downloadCount, setDownloadCount] = useState(0);
  const firedRef = useRef(false);
  const slowFiredRef = useRef(false);

  useEffect(() => {
    const live = detectPlatformClient();
    setPlatform(live);

    const net = readNetwork();
    const slow = SLOW_TYPES.includes(net.effectiveType) || net.saveData;

    track("install_page_viewed", {
      platform: live,
      effective_type: net.effectiveType,
      save_data: net.saveData,
      referrer: typeof document !== "undefined" ? document.referrer : "",
    });

    if (slow && !slowFiredRef.current) {
      slowFiredRef.current = true;
      setShowSlow(true);
      track("install_network_slow_warning_shown", {
        effective_type: net.effectiveType,
      });
    }

    if (live === "android" && !firedRef.current) {
      firedRef.current = true;
      const t = window.setTimeout(() => triggerDownload(true), 600);
      return () => window.clearTimeout(t);
    }
  }, []);

  function triggerDownload(auto: boolean) {
    track("apk_download_triggered", {
      platform,
      auto,
      version: APK.version,
    });
    const a = document.createElement("a");
    a.href = APK.url;
    a.download = `ilaaka-v${APK.version}.apk`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDownloadCount((c) => c + 1);
  }

  if (platform !== "android" && platform !== "unknown") {
    return <DesktopFallback />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card-surface p-6 sm:p-7 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="eyebrow mb-1.5">Downloading</p>
            <h2 className="font-serif text-[1.5rem] sm:text-[1.8rem] leading-tight text-fg">
              Your Ilaaka APK is on its way.
            </h2>
          </div>
          <span
            className="font-mono text-[11px] tracking-[0.14em] uppercase text-fg-muted/80 px-3 py-1.5 rounded-full"
            style={{ borderWidth: 1, borderColor: "var(--color-rule)" }}
          >
            v{APK.version} · {formatMb(APK.sizeBytes)} · Android {APK.minAndroid}+
          </span>
        </div>

        {showSlow ? (
          <div
            className="rounded-xl px-4 py-3 text-[0.92rem] leading-relaxed"
            style={{
              backgroundColor: "color-mix(in oklab, #f0a500 18%, var(--color-canvas))",
              border: "1px solid color-mix(in oklab, #f0a500 50%, var(--color-rule))",
              color: "var(--color-fg)",
            }}
            role="status"
          >
            <strong className="font-medium">Slow connection detected.</strong>{" "}
            {formatMb(APK.sizeBytes)} on mobile data takes a while — switch to
            Wi-Fi for the smoothest install.
          </div>
        ) : null}

        <p className="text-fg-muted/80 text-[0.95rem] leading-relaxed max-w-[58ch]">
          The download starts automatically. If it doesn{"'"}t,{" "}
          <button
            type="button"
            onClick={() => triggerDownload(false)}
            className="underline decoration-dotted underline-offset-4 text-fg hover:opacity-70 transition-opacity"
          >
            tap here to start it manually
          </button>
          .
        </p>

        <p className="font-mono text-[10px] tracking-[0.14em] text-fg-subtle break-all">
          sha256 …{shortSha(APK.sha256)} · released {APK.releasedAt}
          {downloadCount > 1 ? ` · retried ${downloadCount - 1}×` : ""}
        </p>
      </div>
    </div>
  );
}

function DesktopFallback() {
  return (
    <div className="card-surface p-7 sm:p-9 text-center flex flex-col items-center gap-5">
      <p className="eyebrow">Open on your phone</p>
      <h2 className="font-serif text-[1.6rem] sm:text-[2rem] leading-tight text-fg max-w-[26ch]">
        Ilaaka is Android-only for now. Scan to install.
      </h2>
      <div
        className="w-[220px] h-[220px] rounded-2xl grid place-items-center p-3"
        style={{
          backgroundColor: "#f8f1e3",
          boxShadow: "0 30px 60px -20px rgba(0,0,0,0.45)",
          border: "1px solid var(--color-rule)",
        }}
      >
        <QrCode value={INSTALL_URL} size={196} />
      </div>
      <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-fg-subtle">
        v{APK.version} · {formatMb(APK.sizeBytes)} · Android {APK.minAndroid}+
      </p>
    </div>
  );
}
