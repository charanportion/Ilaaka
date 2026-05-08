import Image from "next/image";
import { InstallButton } from "./InstallButton";

type Props = {
  onOpenWaitlist: (context: "ios_waitlist") => void;
  onOpenQr: () => void;
};

export function FounderNote({ onOpenWaitlist, onOpenQr }: Props) {
  return (
    <section
      id="founder"
      className="relative px-5 sm:px-8 py-24 sm:py-36 bg-canvas overflow-hidden"
    >
      {/* paper-tape style accent in the corner — uses the theme's CTA pair
          so the tape always contrasts against the canvas */}
      <div
        aria-hidden
        className="absolute top-10 right-[-40px] sm:right-[-20px] rotate-[8deg]"
      >
        <span
          className="block px-12 py-1.5 font-mono text-[10px] tracking-[0.32em] uppercase font-bold opacity-90"
          style={{
            backgroundColor: "var(--color-cta-bg)",
            color: "var(--color-cta-fg)",
          }}
        >
          From the founder · 2026
        </span>
      </div>

      <div className="mx-auto max-w-[1100px] grid gap-12 sm:gap-16 md:grid-cols-[180px_1fr] items-start">
        <div className="flex md:flex-col items-start gap-4">
          {/* avatar — subtle warm-grey gradient ring works in both themes */}
          <div className="relative">
            <div
              className="w-20 h-20 sm:w-32 sm:h-32 rounded-full p-[3px]"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-fg), color-mix(in oklab, var(--color-fg) 70%, transparent), color-mix(in oklab, var(--color-fg) 35%, transparent))",
              }}
            >
              <Image
                src="/founder.jpg"
                alt="Sri Charan, founder of Ilaaka"
                width={128}
                height={128}
                sizes="(min-width: 640px) 128px, 80px"
                className="w-full h-full rounded-full object-cover"
                style={{ backgroundColor: "var(--color-canvas-2)" }}
              />
            </div>
            {/* tiny verified dot */}
            <span
              className="absolute bottom-1 right-1 w-5 h-5 rounded-full"
              style={{
                backgroundColor: "var(--color-fg)",
                borderWidth: 3,
                borderStyle: "solid",
                borderColor: "var(--color-canvas)",
              }}
            />
          </div>
          <div className="md:mt-3">
            <p className="font-display text-[1.2rem] font-bold leading-none text-fg">
              Sri Charan
            </p>
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-subtle mt-1.5">
              Founder · Hyderabad
            </p>
          </div>
        </div>

        <div className="font-display text-[1.4rem] sm:text-[1.7rem] leading-[1.35] text-fg/95 max-w-[58ch]">
          <span className="text-fg">Hi, I'm Sri.</span>
          <p className="mt-6 text-[1.05rem] sm:text-[1.18rem] leading-[1.7] font-body text-fg-muted/85">
            I built Ilaaka because the fitness apps I tried felt either
            chore-like (track everything, hit numbers, never miss a day) or
            disconnected from the city I actually live in. A run in Jubilee Hills
            feels different from a run in Banjara Hills — the map should know
            that.
          </p>
          <p className="mt-5 text-[1.05rem] sm:text-[1.18rem] leading-[1.7] font-body text-fg-muted/85">
            If you try Ilaaka and something feels off, write to me directly:{" "}
            <a
              href="mailto:sricharan.rayala@dotportion.com"
              className="text-fg underline decoration-dotted underline-offset-4 hover:opacity-70 transition-opacity"
            >
              sricharan.rayala@dotportion.com
            </a>
            . I read every email, and your feedback genuinely changes what I
            build next.
          </p>

          <div className="mt-9 flex items-center gap-4">
            <span
              className="block w-12 h-px"
              style={{ backgroundColor: "var(--color-rule-strong)" }}
            />
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-fg-subtle">
              Apna ilaaka. Apni fitness. — Sri Charan
            </span>
          </div>

          <div className="mt-12">
            <InstallButton
              location="founder"
              size="md"
              onOpenWaitlist={onOpenWaitlist}
              onOpenQr={onOpenQr}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
