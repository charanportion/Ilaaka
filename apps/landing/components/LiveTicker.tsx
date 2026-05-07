"use client";

import { useEffect, useState } from "react";

/**
 * A faux-live counter for "km claimed in Hyderabad this week".
 * Pure decoration in v0 — replace the seed function with a real fetch later.
 * The number is generated deterministically server-side and only ticks
 * forward in the client to feel alive.
 */
function seedKmThisWeek(): number {
  // Anchor on UTC week so it changes Mondays.
  const now = new Date();
  const weekIndex = Math.floor(
    (now.getTime() - Date.UTC(2026, 0, 5)) / (7 * 24 * 3600 * 1000),
  );
  // Slow drift, with the look of a number worth bragging about.
  return 4127 + weekIndex * 318 + Math.floor(weekIndex * 0.7) * 13;
}

export function LiveTicker() {
  const [km, setKm] = useState(seedKmThisWeek);
  const [walkers, setWalkers] = useState(842);

  useEffect(() => {
    const id = window.setInterval(() => {
      setKm((k) => k + (Math.random() < 0.4 ? 1 : 0));
      setWalkers((w) => w + (Math.random() < 0.18 ? 1 : 0));
    }, 2200);
    return () => window.clearInterval(id);
  }, []);

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
          across Hyderabad hexes
        </p>
      </div>
      <div
        className="pl-4 sm:pl-8"
        style={{ borderLeft: "1px solid var(--color-rule)" }}
      >
        <p className="eyebrow mb-2">Active walkers</p>
        <p className="font-mono text-[2rem] sm:text-[2.4rem] font-bold leading-none text-fg tabular-nums">
          {walkers.toLocaleString("en-IN")}
        </p>
        <p className="mt-1.5 text-[12px] text-fg-subtle">
          on the map right now
        </p>
      </div>
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
    </div>
  );
}
