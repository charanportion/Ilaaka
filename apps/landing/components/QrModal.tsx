"use client";

import { useEffect, useId } from "react";
import { APK_URL } from "@/lib/launch-phases";

type Props = { open: boolean; onClose: () => void };

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
          You'll download the Ilaaka APK and install it directly — no Play
          Store yet.
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
          <FauxQr />
        </div>

        <p className="mt-6 font-mono text-[11px] tracking-[0.18em] uppercase text-fg-subtle">
          Android only · Hyderabad · Beta
        </p>

        <a
          href={APK_URL}
          download="ilaaka.apk"
          className="mt-5 inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] underline decoration-dotted underline-offset-4 text-fg hover:opacity-70 transition-opacity"
        >
          Or download the APK to this device →
        </a>
      </div>
    </div>
  );
}

function FauxQr() {
  /* deterministic 17×17 QR-style bitmap with three positioning markers */
  const N = 17;
  const cells: number[][] = [];
  let s = 1337;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let y = 0; y < N; y++) {
    cells[y] = [];
    for (let x = 0; x < N; x++) {
      cells[y]![x] = rand() > 0.55 ? 1 : 0;
    }
  }
  // place three positioning squares
  const stamp = (px: number, py: number) => {
    for (let dy = 0; dy < 7; dy++)
      for (let dx = 0; dx < 7; dx++) {
        const isBorder = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const isCore = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        const v = isBorder || isCore ? 1 : 0;
        cells[py + dy]![px + dx] = v;
      }
  };
  stamp(0, 0);
  stamp(N - 7, 0);
  stamp(0, N - 7);

  return (
    <svg viewBox={`0 0 ${N} ${N}`} className="w-full h-full">
      {cells.flatMap((row, y) =>
        row.map((v, x) =>
          v ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#08070a" />
          ) : null,
        ),
      )}
      <rect
        x={(N - 3) / 2}
        y={(N - 3) / 2}
        width={3}
        height={3}
        fill="#08070a"
        rx={0.5}
      />
    </svg>
  );
}
