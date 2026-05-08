/**
 * Three real-feel share cards in Instagram Story aspect ratio.
 * Pure SVG/CSS — when real screenshots exist, swap each card for an Image.
 *
 * Each card represents one walker's run: a stylised street grid with a
 * bold coloured route traced over the streets they covered (matches how
 * the mobile app renders zones — see apps/mobile/components/map/ZoneMap.tsx).
 */

const CARDS = [
  {
    name: "Aarav K.",
    location: "Jubilee Hills",
    color: "saffron" as const,
    distance: "5.2 km",
    streets: 11,
    pace: "5'58\"/km",
    seed: 9,
  },
  {
    name: "Priya M.",
    location: "Banjara Hills",
    color: "lime" as const,
    distance: "7.8 km",
    streets: 18,
    pace: "5'12\"/km",
    seed: 4,
  },
  {
    name: "Rohit S.",
    location: "Gachibowli",
    color: "magenta" as const,
    distance: "3.1 km",
    streets: 7,
    pace: "8'20\"/km",
    seed: 23,
  },
];

const COLOR_VAR = {
  saffron: "var(--color-saffron-500)",
  lime: "var(--color-lime-400)",
  magenta: "var(--color-magenta-500)",
  teal: "var(--color-teal-400)",
};

const COLOR_LINE: Record<string, { line: string; glow: string }> = {
  saffron: { line: "#ff7a1a", glow: "#ffaa55" },
  lime: { line: "#c7f340", glow: "#e7ff8a" },
  magenta: { line: "#ff2d87", glow: "#ff7ab8" },
  teal: { line: "#2bd9b8", glow: "#9af0e0" },
};

export function ShareSamples() {
  return (
    <section className="relative px-5 sm:px-8 py-24 sm:py-36 bg-canvas overflow-hidden">
      {/* faint dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-[0.06] pointer-events-none" />
      <div className="mx-auto max-w-[1380px] relative">
        <header className="max-w-3xl">
          <p className="eyebrow mb-5">Made to share</p>
          <h2 className="display-2 text-fg text-balance">
            When your run looks this good,{" "}
            <span className="wonk text-fg">you'll want to share it.</span>
          </h2>
        </header>

        <div
          className="mt-14 sm:mt-20 flex gap-5 sm:gap-7 overflow-x-auto pb-6 -mx-5 px-5 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: "none" }}
        >
          {CARDS.map((c, i) => (
            <ShareCard key={c.name} card={c} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ShareCard({
  card,
  index,
}: {
  card: (typeof CARDS)[number];
  index: number;
}) {
  const accent = COLOR_VAR[card.color];
  const lineColor = COLOR_LINE[card.color]!;
  const route = routeFor(card.seed);

  return (
    <div
      className="snap-start shrink-0 w-[268px] sm:w-[300px] aspect-[9/16] rounded-[28px] relative overflow-hidden border border-white/10"
      style={{
        background: `linear-gradient(165deg, ${accent} -10%, var(--color-ink-900) 55%, var(--color-ink-950) 100%)`,
        transform: `rotate(${index === 1 ? -2 : index === 2 ? 1.5 : -0.5}deg)`,
      }}
    >
      {/* hex pattern + street grid + route */}
      <svg
        viewBox="0 0 100 178"
        className="absolute inset-0 w-full h-full opacity-95"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* faint hex pattern as decorative texture only */}
          <pattern
            id={`hp-${card.color}-${index}`}
            x="0"
            y="0"
            width="14"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <polygon
              points="7,1 13,4 13,10 7,13 1,10 1,4"
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100" height="178" fill={`url(#hp-${card.color}-${index})`} />

        {/* simplified street grid */}
        <g stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" fill="none">
          {[14, 30, 46, 62, 78, 92].map((x) => (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="178" />
          ))}
          {[24, 50, 76, 102, 128, 154].map((y) => (
            <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} />
          ))}
        </g>
        <g
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.1"
          fill="none"
          strokeLinecap="round"
        >
          {[22, 46, 70].map((x) => (
            <line key={`mv${x}`} x1={x} y1="0" x2={x} y2="178" />
          ))}
          {[40, 90, 130].map((y) => (
            <line key={`mh${y}`} x1="0" y1={y} x2="100" y2={y} />
          ))}
        </g>

        {/* the claimed route — thick coloured line tracing the streets */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path
            d={route.d}
            stroke={lineColor.glow}
            strokeWidth="6"
            opacity="0.45"
            filter="blur(2.4px)"
          />
          <path
            d={route.d}
            stroke={lineColor.line}
            strokeWidth="3"
          />
          {/* head dot */}
          <circle
            cx={route.end[0]}
            cy={route.end[1]}
            r="2.4"
            fill="#f8f1e3"
            stroke={lineColor.line}
            strokeWidth="0.8"
          />
        </g>
      </svg>

      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,7,10,0.0) 30%, rgba(8,7,10,0.92) 100%)",
        }}
      />

      {/* top label */}
      <div className="absolute top-5 left-5 right-5 flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-paper-50/80">
          {card.location}
        </span>
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-paper-50/80 flex items-center gap-1.5">
          <span
            className="hex-tile w-2.5 h-[10px]"
            style={{ ["--hex-color" as never]: "rgba(255,255,255,0.85)" }}
          />
          ilaaka
        </span>
      </div>

      {/* bottom stat block */}
      <div className="absolute bottom-5 left-5 right-5">
        <p className="font-display text-[2.15rem] font-bold leading-none text-paper-50 -tracking-[0.025em]">
          {card.distance}
        </p>
        <p className="mt-1 font-mono text-[11px] tracking-[0.16em] uppercase text-paper-50/65">
          {card.name} · {card.streets} streets claimed
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span
            className="font-mono text-[10px] px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(255,255,255,0.12)",
              color: "var(--color-paper-50)",
            }}
          >
            pace · {card.pace}
          </span>
          <span
            className="font-mono text-[10px] px-2 py-0.5 rounded-full"
            style={{
              background: accent,
              color: "var(--color-ink-950)",
              fontWeight: 700,
            }}
          >
            +{card.distance.split(" ")[0]} KM
          </span>
        </div>
      </div>
    </div>
  );
}

/* Generate a deterministic street-following route for each card. The path
   walks an implicit grid so it always looks like a real GPS trace. */
function routeFor(seed: number): { d: string; end: [number, number] } {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const xs = [14, 22, 30, 46, 62, 70, 78];
  const ys = [24, 40, 50, 76, 90, 102, 128, 130];

  /* Pick a starting intersection biased toward the middle of the card. */
  let xi = 1 + Math.floor(rand() * 3);
  let yi = 1 + Math.floor(rand() * 4);
  const pts: [number, number][] = [[xs[xi]!, ys[yi]!]];

  let dir = Math.floor(rand() * 4); // 0=N 1=E 2=S 3=W
  const steps = 8 + Math.floor(rand() * 4);

  for (let i = 0; i < steps; i++) {
    const move = 1 + Math.floor(rand() * 2);
    let nxi = xi;
    let nyi = yi;
    if (dir === 0) nyi = Math.max(0, yi - move);
    else if (dir === 1) nxi = Math.min(xs.length - 1, xi + move);
    else if (dir === 2) nyi = Math.min(ys.length - 1, yi + move);
    else nxi = Math.max(0, xi - move);

    if (nxi === xi && nyi === yi) {
      dir = (dir + 1) % 4;
      continue;
    }
    xi = nxi;
    yi = nyi;
    pts.push([xs[xi]!, ys[yi]!]);
    if (rand() < 0.7) dir = (dir + (rand() < 0.5 ? 1 : 3)) % 4;
  }

  const d = pts
    .map((p, i) =>
      i === 0
        ? `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`
        : `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`,
    )
    .join(" ");

  return { d, end: pts[pts.length - 1]! };
}
