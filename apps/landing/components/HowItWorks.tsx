import { PhoneMockup } from "./PhoneMockup";
import { HexMap } from "./HexMap";

const STEPS = [
  {
    n: "01",
    title: "Walk your route.",
    body:
      "Hit start. Walk, run or cycle anywhere. We track your route while your phone's in your pocket.",
    tone: "saffron" as const,
    screen: <RecorderScreen />,
  },
  {
    n: "02",
    title: "Claim your zone.",
    body:
      "Every street you covered lights up in your colour on the map — your territory, traced along the roads you walked.",
    tone: "lime" as const,
    screen: <ClaimedScreen />,
  },
  {
    n: "03",
    title: "Defend or expand.",
    body:
      "Friends and rivals can re-walk your streets to flip them. Walk back to take them. Every week resets the leaderboard.",
    tone: "magenta" as const,
    screen: <NotifScreen />,
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative px-5 sm:px-8 py-24 sm:py-36 bg-canvas"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, var(--color-rule), transparent)",
        }}
      />
      <div className="mx-auto max-w-[1380px]">
        <header className="max-w-3xl">
          <p className="eyebrow mb-5">The loop</p>
          <h2 className="display-2 text-fg text-balance">
            Walk it. Claim it.{" "}
            <span className="wonk text-fg">Defend it.</span>
          </h2>
          <p className="mt-6 max-w-[52ch] text-fg-muted/75 text-[1.05rem] leading-[1.6]">
            Three steps, one habit. The map remembers every street you covered
            — and so do your friends.
          </p>
        </header>

        <div className="mt-16 sm:mt-24 grid gap-10 sm:gap-14 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <article
              key={step.n}
              className="relative flex flex-col items-start"
              style={{
                transform: i === 1 ? "translateY(36px)" : "translateY(0)",
              }}
            >
              <div className="flex items-baseline gap-3 mb-6">
                <span
                  className="font-mono text-[11px] tracking-[0.3em] text-fg-subtle uppercase"
                >
                  Step
                </span>
                <span
                  className="font-display text-[3.4rem] leading-none -tracking-[0.04em]"
                  style={{ color: "color-mix(in oklab, var(--color-fg) 12%, transparent)" }}
                >
                  {step.n}
                </span>
              </div>
              <PhoneMockup tone={step.tone} className="w-full">
                {step.screen}
              </PhoneMockup>
              <h3 className="mt-8 display-3 text-fg max-w-[14ch] text-balance">
                {step.title}
              </h3>
              <p className="mt-3 text-fg-muted/70 text-[0.98rem] leading-[1.55] max-w-[34ch]">
                {step.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Stylized in-app screens (pure CSS/SVG) ----------------- */

function RecorderScreen() {
  return (
    <div className="absolute inset-0 flex flex-col">
      {/* recorder background */}
      <div className="absolute inset-0 opacity-50">
        <HexMap rings={5} size={14} seed={42} className="w-full h-full" />
      </div>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,7,10,0.0) 30%, rgba(8,7,10,0.85) 70%)",
        }}
      />

      {/* current path line */}
      <svg
        viewBox="0 0 100 200"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <path
          d="M14,40 C30,55 32,82 50,90 C70,99 80,120 70,150 C62,170 40,170 28,180"
          fill="none"
          stroke="#ff7a1a"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="6 5"
        />
        <circle cx="28" cy="180" r="3.5" fill="#ff7a1a" />
        <circle
          cx="28"
          cy="180"
          r="3.5"
          fill="none"
          stroke="#ff7a1a"
          strokeWidth="1"
          opacity="0.6"
          style={{
            transformOrigin: "28px 180px",
            animation: "pulse-ring 2s ease-out infinite",
          }}
        />
      </svg>

      {/* bottom card — in-app chrome, stays monochrome */}
      <div className="mt-auto m-3 rounded-2xl bg-ink-900/90 backdrop-blur-md border border-white/10 p-3 flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-paper-50 flex items-center justify-center">
          <span className="w-3 h-3 rounded-[2px] bg-ink-950" />
        </span>
        <div className="flex-1">
          <p className="font-mono text-[8px] tracking-[0.2em] uppercase text-paper-100/60">
            recording · 12:48
          </p>
          <p className="font-display text-[1.25rem] font-bold text-paper-50 leading-none mt-1">
            2.4 km
          </p>
        </div>
        <span className="font-mono text-[10px] text-paper-50">●</span>
      </div>
    </div>
  );
}

function ClaimedScreen() {
  /* Several saffron route-segments tracing claimed streets, drawn over a
     simplified street grid. Geometry is intentionally hand-tuned so it
     reads clearly at phone-mockup scale. */
  const claimedRoutes = [
    "M22,60 L22,118 L60,118 L60,80 L78,80",
    "M22,118 L52,118 L52,140 L80,140",
    "M44,60 L44,98 L70,98",
  ];
  return (
    <div className="absolute inset-0">
      {/* simplified street grid background */}
      <svg
        viewBox="0 0 100 200"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <g stroke="#231f29" strokeWidth="0.7" fill="none">
          {[12, 32, 52, 72, 92].map((x) => (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="200" />
          ))}
          {[40, 80, 120, 160].map((y) => (
            <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} />
          ))}
        </g>
        <g stroke="#3a3544" strokeWidth="1.4" fill="none" strokeLinecap="round">
          {[22, 44, 60, 78].map((x) => (
            <line key={`mv${x}`} x1={x} y1="0" x2={x} y2="200" />
          ))}
          {[60, 98, 118, 140].map((y) => (
            <line key={`mh${y}`} x1="0" y1={y} x2="100" y2={y} />
          ))}
        </g>

        {/* claimed routes — saffron lines tracing the streets */}
        <g
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {claimedRoutes.map((d, i) => (
            <g key={i}>
              <path
                d={d}
                stroke="#ffaa55"
                strokeWidth="6"
                opacity="0.4"
                filter="blur(2px)"
                style={{
                  strokeDasharray: 400,
                  strokeDashoffset: 0,
                  animation: `claim-draw 1.4s cubic-bezier(.4,.7,.3,1) ${i * 250}ms both`,
                }}
              />
              <path
                d={d}
                stroke="#ff7a1a"
                strokeWidth="3"
                style={{
                  strokeDasharray: 400,
                  strokeDashoffset: 0,
                  animation: `claim-draw 1.4s cubic-bezier(.4,.7,.3,1) ${i * 250}ms both`,
                }}
              />
            </g>
          ))}
        </g>
      </svg>

      <style>{`
        @keyframes claim-draw {
          from { stroke-dashoffset: 400; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,7,10,0.0) 0%, rgba(8,7,10,0.0) 50%, rgba(8,7,10,0.85) 80%)",
        }}
      />
      <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-ink-900/90 backdrop-blur-md border border-white/15 p-3">
        <p className="font-mono text-[8px] tracking-[0.2em] uppercase text-paper-50">
          new territory
        </p>
        <p className="mt-1 font-display text-[1.1rem] font-bold text-paper-50 leading-tight">
          1.8 km of streets claimed
        </p>
        <p className="font-mono text-[10px] text-paper-100/60 mt-0.5">
          Road No. 12 · Banjara Hills
        </p>
      </div>
    </div>
  );
}

function NotifScreen() {
  /* A short magenta segment shows a stretch of street that was just
     stolen. Visually distinct from the saffron ClaimedScreen — same
     map vocabulary, different colour-of-the-week. */
  return (
    <div className="absolute inset-0">
      {/* simplified street grid background */}
      <svg
        viewBox="0 0 100 200"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <g stroke="#231f29" strokeWidth="0.7" fill="none">
          {[14, 34, 54, 76, 94].map((x) => (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="200" />
          ))}
          {[60, 100, 140, 175].map((y) => (
            <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} />
          ))}
        </g>
        <g stroke="#3a3544" strokeWidth="1.4" fill="none" strokeLinecap="round">
          {[24, 46, 64, 82].map((x) => (
            <line key={`mv${x}`} x1={x} y1="0" x2={x} y2="200" />
          ))}
          {[80, 120, 150].map((y) => (
            <line key={`mh${y}`} x1="0" y1={y} x2="100" y2={y} />
          ))}
        </g>

        {/* a faint saffron stretch the user once owned, fading away */}
        <path
          d="M14,150 L46,150 L46,120 L82,120"
          stroke="#ff7a1a"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          opacity="0.18"
          strokeDasharray="3 3"
        />

        {/* the stolen segment in magenta */}
        <g
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M14,150 L46,150 L46,120 L82,120"
            stroke="#ff7ab8"
            strokeWidth="6"
            opacity="0.45"
            filter="blur(2px)"
            style={{
              strokeDasharray: 300,
              strokeDashoffset: 0,
              animation: `steal-draw 1.4s cubic-bezier(.4,.7,.3,1) 350ms both`,
            }}
          />
          <path
            d="M14,150 L46,150 L46,120 L82,120"
            stroke="#ff2d87"
            strokeWidth="3"
            style={{
              strokeDasharray: 300,
              strokeDashoffset: 0,
              animation: `steal-draw 1.4s cubic-bezier(.4,.7,.3,1) 350ms both`,
            }}
          />
        </g>
      </svg>

      <style>{`
        @keyframes steal-draw {
          from { stroke-dashoffset: 300; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(8,7,10,0.45)" }}
      />

      {/* notification card */}
      <div className="absolute top-9 left-3 right-3 rounded-2xl bg-paper-50/95 text-ink-950 p-3 shadow-2xl">
        <div className="flex items-start gap-2.5">
          <span className="w-7 h-7 rounded-md bg-ink-950 flex items-center justify-center text-paper-50 font-bold text-[14px]">
            P
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
              Ilaaka · just now
            </p>
            <p className="text-[12px] font-semibold leading-tight mt-1">
              Priya captured your zone
            </p>
            <p className="text-[10.5px] text-ink-500 leading-tight mt-0.5">
              420 m of Road No. 12 is now hers. Walk it back to take it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
