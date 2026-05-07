"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Animated map of Hyderabad streets with claimed-route overlays.
 *
 * The mobile app renders zones as GeoJSON `line` layers tracing the
 * streets a walker covered (see apps/mobile/components/map/ZoneMap.tsx).
 * This landing-page map mirrors that: a faint street grid, with thick
 * coloured polylines drawing themselves over the streets — each line
 * is one walker's claimed territory in their colour.
 *
 * Component is named HexMap for back-compat with existing imports;
 * what it renders is a route map. Rename in a follow-up.
 *
 * Render is deterministic (seeded RNG) so SSR + client output match.
 */

type Props = {
  /** Hint controlling overall map density. */
  size?: number;
  /** Number of "rings" — kept for API compat; controls map dimensions. */
  rings?: number;
  /** Seed for deterministic layout. */
  seed?: number;
  className?: string;
  ariaHidden?: boolean;
};

const TERRITORY_COLORS = [
  "saffron",
  "saffron",
  "saffron",
  "lime",
  "magenta",
  "teal",
] as const;

const COLOR_HEX: Record<string, { line: string; glow: string }> = {
  saffron: { line: "#ff7a1a", glow: "#ffaa55" },
  lime: { line: "#c7f340", glow: "#e7ff8a" },
  magenta: { line: "#ff2d87", glow: "#ff7ab8" },
  teal: { line: "#2bd9b8", glow: "#9af0e0" },
};

type Streets = {
  majorV: number[];
  majorH: number[];
  minorV: number[];
  minorH: number[];
};

type Route = {
  d: string;
  length: number;
  end: { x: number; y: number };
  color: string;
  delay: number;
  drawDuration: number;
};

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateStreets(rng: () => number, W: number, H: number): Streets {
  const majorV: number[] = [];
  for (let i = 1; i < 7; i++) {
    majorV.push((W / 7) * i + (rng() - 0.5) * 28);
  }
  const majorH: number[] = [];
  for (let i = 1; i < 6; i++) {
    majorH.push((H / 6) * i + (rng() - 0.5) * 22);
  }

  const minorV: number[] = [];
  for (let i = 0; i < majorV.length - 1; i++) {
    const a = majorV[i]!;
    const b = majorV[i + 1]!;
    minorV.push((a + b) / 2 + (rng() - 0.5) * 14);
  }
  const minorH: number[] = [];
  for (let i = 0; i < majorH.length - 1; i++) {
    const a = majorH[i]!;
    const b = majorH[i + 1]!;
    minorH.push((a + b) / 2 + (rng() - 0.5) * 12);
  }

  return { majorV, majorH, minorV, minorH };
}

/* Walk a grid of intersections, turning occasionally, producing a
   street-following route as a list of points. */
function generateRoutePoints(
  rng: () => number,
  streets: Streets,
  W: number,
  H: number,
  steps: number,
): { x: number; y: number }[] {
  const allV = [...streets.majorV, ...streets.minorV].sort((a, b) => a - b);
  const allH = [...streets.majorH, ...streets.minorH].sort((a, b) => a - b);

  const startVi = Math.floor(rng() * allV.length);
  const startHi = Math.floor(rng() * allH.length);
  let vi = startVi;
  let hi = startHi;

  const pts: { x: number; y: number }[] = [{ x: allV[vi]!, y: allH[hi]! }];

  // 0=N, 1=E, 2=S, 3=W
  let dir = Math.floor(rng() * 4);

  for (let i = 0; i < steps; i++) {
    const move = 1 + Math.floor(rng() * 2);
    let nvi = vi;
    let nhi = hi;
    if (dir === 0) nhi = Math.max(0, hi - move);
    else if (dir === 1) nvi = Math.min(allV.length - 1, vi + move);
    else if (dir === 2) nhi = Math.min(allH.length - 1, hi + move);
    else nvi = Math.max(0, vi - move);

    if (nvi === vi && nhi === hi) {
      dir = (dir + 1 + Math.floor(rng() * 3)) % 4;
      continue;
    }

    vi = nvi;
    hi = nhi;
    pts.push({ x: allV[vi]!, y: allH[hi]! });

    /* Turn ~70% of the time so the route doesn't run straight forever. */
    if (rng() < 0.7) {
      const turn = rng() < 0.5 ? 1 : 3;
      dir = (dir + turn) % 4;
    }
  }
  return pts;
}

function pointsToPath(pts: { x: number; y: number }[]): string {
  return pts
    .map((p, i) =>
      i === 0
        ? `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`
        : `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
    )
    .join(" ");
}

function pathLength(pts: { x: number; y: number }[]): number {
  let n = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i]!.x - pts[i - 1]!.x;
    const dy = pts[i]!.y - pts[i - 1]!.y;
    n += Math.sqrt(dx * dx + dy * dy);
  }
  return n;
}

export function HexMap({
  size = 18,
  rings = 9,
  seed = 7331,
  className,
  ariaHidden = true,
}: Props) {
  /* Map dimensions scale loosely with `rings` so the small in-phone
     instances render at a similar intersection density to the hero. */
  const W = Math.max(360, rings * 130);
  const H = Math.max(220, rings * 80);

  const data = useMemo(() => {
    const rng = mulberry32(seed);
    const streets = generateStreets(rng, W, H);

    const routes: Route[] = [];
    const wanted = Math.max(4, Math.min(8, Math.round(rings * 0.8)));
    let attempts = 0;
    while (routes.length < wanted && attempts < wanted * 4) {
      attempts++;
      const stepCount = 7 + Math.floor(rng() * 7);
      const pts = generateRoutePoints(rng, streets, W, H, stepCount);
      if (pts.length < 4) continue;
      const len = pathLength(pts);
      if (len < W * 0.3) continue;
      const color =
        TERRITORY_COLORS[Math.floor(rng() * TERRITORY_COLORS.length)]!;
      routes.push({
        d: pointsToPath(pts),
        length: len,
        end: pts[pts.length - 1]!,
        color,
        delay: rng() * 3.2,
        drawDuration: 2.2 + rng() * 1.4,
      });
    }
    return { streets, routes };
  }, [seed, rings, W, H, size]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      role={ariaHidden ? "presentation" : undefined}
      aria-hidden={ariaHidden}
    >
      <defs>
        <filter id="rt-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="rt-dot-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* faint hex texture — opacity-only so it works on any canvas */}
        <pattern
          id="rt-hex-texture"
          x="0"
          y="0"
          width="36"
          height="32"
          patternUnits="userSpaceOnUse"
        >
          <polygon
            points="18,2 33,10 33,24 18,32 3,24 3,10"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.05"
            strokeWidth="0.6"
          />
        </pattern>
      </defs>

      {/* atmosphere layer — strokes use currentColor (set on the SVG below) */}
      <g style={{ color: "var(--color-fg)" }}>
        <rect width={W} height={H} fill="url(#rt-hex-texture)" />
      </g>

      {/* minor streets — derived from the foreground colour with low opacity
          so they read on either canvas (cream or near-black). */}
      <g
        stroke="var(--color-fg)"
        strokeOpacity="0.18"
        strokeWidth="0.9"
        fill="none"
      >
        {data.streets.minorV.map((x, i) => (
          <path key={`mv-${i}`} d={`M${x.toFixed(1)} 0 L${x.toFixed(1)} ${H}`} />
        ))}
        {data.streets.minorH.map((y, i) => (
          <path key={`mh-${i}`} d={`M0 ${y.toFixed(1)} L${W} ${y.toFixed(1)}`} />
        ))}
      </g>

      {/* major streets */}
      <g
        stroke="var(--color-fg)"
        strokeOpacity="0.32"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      >
        {data.streets.majorV.map((x, i) => (
          <path key={`MV-${i}`} d={`M${x.toFixed(1)} 0 L${x.toFixed(1)} ${H}`} />
        ))}
        {data.streets.majorH.map((y, i) => (
          <path key={`MH-${i}`} d={`M0 ${y.toFixed(1)} L${W} ${y.toFixed(1)}`} />
        ))}
      </g>

      {/* territory routes — thick coloured lines drawing themselves */}
      <g
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* glow pass */}
        {data.routes.map((r, i) => (
          <path
            key={`g-${i}`}
            d={r.d}
            stroke={COLOR_HEX[r.color]!.glow}
            strokeWidth="11"
            opacity="0.42"
            filter="url(#rt-glow)"
            strokeDasharray={r.length}
            strokeDashoffset={mounted ? 0 : r.length}
            style={{
              transition: `stroke-dashoffset ${r.drawDuration}s cubic-bezier(.4,.7,.3,1) ${r.delay}s`,
            }}
          />
        ))}
        {/* main line */}
        {data.routes.map((r, i) => (
          <path
            key={`l-${i}`}
            d={r.d}
            stroke={COLOR_HEX[r.color]!.line}
            strokeWidth="4.5"
            strokeDasharray={r.length}
            strokeDashoffset={mounted ? 0 : r.length}
            style={{
              transition: `stroke-dashoffset ${r.drawDuration}s cubic-bezier(.4,.7,.3,1) ${r.delay}s`,
            }}
          />
        ))}
      </g>

      {/* current-position dots at the head of each route */}
      <g filter="url(#rt-dot-glow)">
        {data.routes.map((r, i) => {
          const appearAt = r.delay + r.drawDuration * 0.85;
          return (
            <g
              key={`d-${i}`}
              transform={`translate(${r.end.x.toFixed(1)} ${r.end.y.toFixed(1)})`}
              style={{
                opacity: mounted ? 1 : 0,
                transition: `opacity 500ms ease ${appearAt}s`,
              }}
            >
              <circle r="4.5" fill="var(--color-fg)" />
              <circle
                r="4.5"
                fill="none"
                stroke="var(--color-fg)"
                strokeWidth="1.6"
                style={{
                  transformOrigin: "center",
                  animation: `pulse-ring 2.4s cubic-bezier(.2,.7,.3,1) infinite`,
                  animationDelay: `${appearAt}s`,
                }}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
