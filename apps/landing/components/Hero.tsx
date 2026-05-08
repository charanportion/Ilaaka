"use client";

import { HexMap } from "./HexMap";
import { InstallButton } from "./InstallButton";
import { LiveTicker } from "./LiveTicker";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  onOpenWaitlist: (context: "ios_waitlist") => void;
  onOpenQr: () => void;
};

export function Hero({ onOpenWaitlist, onOpenQr }: Props) {
  return (
    <section className="relative overflow-hidden bg-hex-grid">
      {/* hex map back layer — territories pop on the canvas in either theme */}
      <div className="absolute inset-0 -z-0">
        <HexMap className="absolute inset-0 w-full h-full opacity-90" />
        {/* Vignette + edge fades use the theme's canvas colour so the
            section blends seamlessly into whichever bg the page is on. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 70% at 50% 60%, transparent 0%, color-mix(in oklab, var(--color-canvas) 35%, transparent) 55%, color-mix(in oklab, var(--color-canvas) 95%, transparent) 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-40 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--color-canvas) 92%, transparent), transparent)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
          style={{
            background:
              "linear-gradient(0deg, var(--color-canvas), transparent)",
          }}
        />
      </div>

      {/* top chrome — brand + locality pill + theme toggle. */}
      <div className="relative z-10 mx-auto max-w-[1380px] px-5 sm:px-8 pt-6 sm:pt-8 flex items-center justify-between gap-3">
        <Wordmark />
        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md text-[12px] font-mono uppercase tracking-[0.18em] text-fg/80"
            style={{
              borderWidth: 1,
              borderColor: "var(--color-rule-strong)",
              backgroundColor:
                "color-mix(in oklab, var(--color-fg) 4%, transparent)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{
                backgroundColor: "var(--color-fg)",
                boxShadow:
                  "0 0 12px color-mix(in oklab, var(--color-fg) 60%, transparent)",
              }}
            />
            Hyderabad · Beta v0
          </span>
          <ThemeToggle />
        </div>
      </div>

      {/* main copy block */}
      <div className="relative z-10 mx-auto max-w-[1380px] px-5 sm:px-8 pt-12 sm:pt-20 pb-28 sm:pb-44">
        <p className="eyebrow mb-6 sm:mb-8 inline-flex items-center gap-3">
          <span
            className="hex-tile inline-block w-3 h-[14px]"
            style={{ ["--hex-color" as never]: "var(--color-fg)" }}
          />
          A fitness territory game for India
        </p>

        <h1 className="display-1 text-fg max-w-[18ch] text-balance">
          <span>Apna </span>
          <span className="scribble">
            <span className="scribble-text relative z-10">Ilaaka.</span>
          </span>
          <br />
          <span>Apni </span>
          <span className="wonk text-fg">Fitness.</span>
        </h1>

        <p className="mt-7 sm:mt-9 max-w-[44ch] text-fg-muted/85 text-[1.06rem] sm:text-[1.18rem] leading-[1.55] text-pretty">
          The fitness app where every step claims territory. Walk, run, or
          cycle your neighbourhood — your route locks in coloured zones on the
          map. Friends can steal them back. You walk again to defend.
        </p>

        {/* CTA block */}
        <div className="mt-9 sm:mt-12 flex flex-wrap items-center gap-4 sm:gap-5">
          <InstallButton
            location="hero"
            onOpenWaitlist={onOpenWaitlist}
            onOpenQr={onOpenQr}
          />
          <a
            href="#how-it-works"
            className="btn-pill btn-ghost text-[0.95rem]"
          >
            How it works
            <span aria-hidden className="opacity-60">↓</span>
          </a>
        </div>

        <p className="mt-5 font-mono text-[12px] tracking-[0.06em] text-fg-subtle max-w-[40ch]">
          Free direct APK download · Currently in Hyderabad · iOS coming soon
        </p>

        {/* live ticker — gives the page a heartbeat */}
        <div className="mt-10 sm:mt-14 max-w-[640px]">
          <LiveTicker />
        </div>
      </div>

      {/* trust line — sits at the bottom of the hero */}
      <div className="relative z-10 mx-auto max-w-[1380px] px-5 sm:px-8 pb-10">
        <div className="rule-dashed mb-5 opacity-50" />
        <p className="font-mono text-[11.5px] tracking-[0.14em] uppercase text-fg-subtle max-w-[60ch]">
          Built in Hyderabad · Privacy by default — your home address never
          leaves your device
        </p>
      </div>
    </section>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 text-fg">
      <span
        className="hex-tile w-7 h-[26px]"
        style={{ ["--hex-color" as never]: "var(--color-fg)" }}
      />
      <span className="font-display text-[1.6rem] tracking-[-0.02em] font-bold leading-none">
        ilaaka
      </span>
    </div>
  );
}
