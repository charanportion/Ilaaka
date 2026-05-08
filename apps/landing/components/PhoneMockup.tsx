import { ReactNode } from "react";

/**
 * Lightweight phone mockup. Pure CSS/SVG — no real screenshot dependency.
 * The mockup chrome (bezel, glow, status bar) is monochrome — only the
 * `children` content (the in-app screen) carries territory colour.
 *
 * `tone` is preserved for backwards-compat callers but is now ignored.
 */
export function PhoneMockup({
  children,
  className,
  rotate = 0,
}: {
  children: ReactNode;
  /** Deprecated — bezel is monochrome regardless. Kept so existing call sites don't break. */
  tone?: "saffron" | "lime" | "magenta" | "teal";
  className?: string;
  rotate?: number;
}) {
  return (
    <div
      className={`relative ${className ?? ""}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {/* monochrome glow */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--color-paper-50) 24%, transparent), transparent 70%)",
        }}
      />
      <div
        className="relative aspect-[9/19] w-full max-w-[280px] mx-auto rounded-[42px] p-[6px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
        style={{
          background:
            "linear-gradient(155deg, #2a2632 0%, #15131a 50%, #08070a 100%)",
          border:
            "1px solid color-mix(in oklab, var(--color-paper-50) 14%, transparent)",
        }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-[36px]"
          style={{
            background: "linear-gradient(180deg, #0e0c10, #08070a)",
          }}
        >
          {/* notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-[68px] h-[18px] bg-ink-950 rounded-full border border-white/5" />
          {/* status bar */}
          <div className="absolute top-2.5 left-0 right-0 z-10 px-5 flex justify-between text-[9px] font-mono text-paper-50/70 tracking-wider">
            <span>9:41</span>
            <span>5G</span>
          </div>
          <div className="absolute inset-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
