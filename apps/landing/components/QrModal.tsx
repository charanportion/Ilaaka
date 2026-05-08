"use client";

import { useEffect, useId } from "react";
import { QrCode } from "@/components/install/QrCode";

type Props = { open: boolean; onClose: () => void };

const INSTALL_URL = "https://ilaaka.app/install";

export function QrModal({ open, onClose }: Props) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[80] flex items-center justify-center"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 backdrop-blur-md"
        style={{ backgroundColor: "color-mix(in oklab, var(--color-canvas) 80%, transparent)" }}
      />
      <div className="relative card-surface w-full max-w-[420px] mx-4 p-8 sm:p-10 text-center animate-tick-up">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 rounded-full grid place-items-center transition-colors text-fg-muted/70 hover:text-fg"
          style={{ borderWidth: 1, borderColor: "var(--color-rule)" }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M5 5 L19 19 M5 19 L19 5" />
          </svg>
        </button>

        <p className="eyebrow mb-3">Scan to install</p>
        <h3 id={titleId} className="display-3 text-fg max-w-[20ch] mx-auto">
          Point your phone at the code.
        </h3>
        <p className="mt-3 text-fg-muted/70 text-[0.95rem] max-w-[34ch] mx-auto">
          Scanning lands on our install page where the APK download starts
          automatically and the install steps are explained.
        </p>

        {/* QR plate stays paper-cream regardless of theme — most QR scanners
            expect the high-contrast cream-on-black look. */}
        <div
          className="mt-7 mx-auto w-[220px] h-[220px] rounded-2xl grid place-items-center p-3"
          style={{
            backgroundColor: "#f8f1e3",
            boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6)",
            border: "1px solid var(--color-rule)",
          }}
        >
          <QrCode value={INSTALL_URL} size={196} />
        </div>

        <p className="mt-6 font-mono text-[11px] tracking-[0.18em] uppercase text-fg-subtle">
          Android only · Hyderabad · Beta
        </p>

        <a
          href="/install"
          className="mt-5 inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] underline decoration-dotted underline-offset-4 text-fg hover:opacity-70 transition-opacity"
        >
          Or open the install page on this device →
        </a>
      </div>
    </div>
  );
}
