"use client";

import { useEffect, useState } from "react";
import type { LandingStats, RecentClaim } from "@/app/api/live-stats/route";

/* Below these thresholds the two-number widget would read embarrassingly
   small ("18 km · 6 walkers"), so we swap to the recent-activity feed
   instead. Tuned to feel respectable, not aspirational. */
const KM_THRESHOLD = 100;
const WALKER_THRESHOLD = 50;
const REFETCH_MS = 60_000;

export function LiveTicker() {
  const [stats, setStats] = useState<LandingStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/live-stats");
        if (!res.ok) return;
        const json = (await res.json()) as LandingStats;
        if (!cancelled) setStats(json);
      } catch {
        /* swallow — widget hides when stats stays null */
      }
    }

    load();
    const id = window.setInterval(load, REFETCH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!stats) return null;

  const meetsThreshold =
    stats.walkers_week >= WALKER_THRESHOLD &&
    stats.km_claimed_week >= KM_THRESHOLD;

  if (meetsThreshold) {
    return (
      <NumbersCard km={stats.km_claimed_week} walkers={stats.walkers_week} />
    );
  }

  if (stats.recent_claims.length === 0) return null;

  return <RecentClaimsCard claims={stats.recent_claims.slice(0, 3)} />;
}

function NumbersCard({ km, walkers }: { km: number; walkers: number }) {
  return (
    <div className="relative card-surface px-5 sm:px-7 py-5 sm:py-6 grid grid-cols-2 gap-4 sm:gap-8">
      <div>
        <p className="eyebrow mb-2">Claimed this week</p>
        <p className="font-mono text-[2rem] sm:text-[2.4rem] font-bold leading-none text-fg tabular-nums">
          {km.toLocaleString("en-IN")}{" "}
          <span className="text-fg-subtle text-[1rem] sm:text-[1.1rem]">
            km
          </span>
        </p>
        <p className="mt-1.5 text-[12px] text-fg-subtle">
          across Hyderabad
        </p>
      </div>
      <div
        className="pl-4 sm:pl-8"
        style={{ borderLeft: "1px solid var(--color-rule)" }}
      >
        <p className="eyebrow mb-2">Walkers this week</p>
        <p className="font-mono text-[2rem] sm:text-[2.4rem] font-bold leading-none text-fg tabular-nums">
          {walkers.toLocaleString("en-IN")}
        </p>
        <p className="mt-1.5 text-[12px] text-fg-subtle">
          claiming territory
        </p>
      </div>
      <LiveBadge />
    </div>
  );
}

function RecentClaimsCard({ claims }: { claims: RecentClaim[] }) {
  return (
    <div className="relative card-surface px-5 sm:px-7 py-5 sm:py-6">
      <p className="eyebrow mb-4">Just claimed</p>
      <ul className="space-y-3 sm:space-y-3.5">
        {claims.map((c) => (
          <li
            key={c.created_at}
            className="flex items-baseline gap-3 sm:gap-4"
          >
            <span
              aria-hidden
              className="shrink-0 inline-block w-2.5 h-2.5 rounded-full self-center"
              style={{
                backgroundColor: c.color,
                boxShadow: `0 0 10px color-mix(in oklab, ${c.color} 55%, transparent)`,
              }}
            />
            <span className="font-mono text-[1rem] sm:text-[1.05rem] font-bold text-fg tabular-nums">
              {c.cells.toLocaleString("en-IN")}
            </span>
            <span className="text-[12px] sm:text-[13px] text-fg-subtle">
              zones
            </span>
            <span className="text-fg-subtle/60 text-[12px]">·</span>
            <span className="text-[12px] sm:text-[13px] text-fg-muted/75 tabular-nums">
              {formatRelative(c.created_at)}
            </span>
          </li>
        ))}
      </ul>
      <LiveBadge />
    </div>
  );
}

function LiveBadge() {
  return (
    <span
      aria-hidden
      className="absolute top-4 right-4 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-fg-subtle"
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{
          backgroundColor: "var(--color-fg)",
          boxShadow:
            "0 0 10px color-mix(in oklab, var(--color-fg) 50%, transparent)",
        }}
      />
      Live
    </span>
  );
}

function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
