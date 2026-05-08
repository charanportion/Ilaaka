"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

const QS = [
  {
    q: "What stops someone driving and claiming the whole city?",
    a: "Speed, the shape of the trace, and how it pauses. Cars sweep wide arcs at corners and don't slow at footpaths; scooters don't stop the way walkers do at signals and crossings. Anything that looks vehicular gets thrown out before it claims a single cell. If a route on your map still looks fishy, the in-app report comes straight to me.",
  },
  {
    q: "Why an APK and not the Play Store?",
    a: "Beta builds ship direct so I can push a fix the same day instead of waiting on a week-long Play Store review. The APK is signed by me and asks for exactly one sensitive permission — location, only while a walk is active. The Play Store listing is in review; once it lands, the app will prompt you to migrate in one tap.",
  },
  {
    q: "Do I need to keep the app open while I walk?",
    a: "No. Hit start, lock your phone, drop it in your pocket. Android keeps a small persistent notification visible while a recording is running — that's what stops the OS from killing the GPS halfway through. Stop the walk from the notification or the app when you're back. A 30-minute walk costs roughly the same battery as a 30-minute call.",
  },
  {
    q: "What if I disappear for a couple of weeks?",
    a: "Zones expire 14 days after the last walk through them — yours or anyone else's. Take a 10-day holiday and your streets are all still there. Take a month off and they fade. Walk any one of your old routes when you're back and the whole stretch clicks back to your colour.",
  },
  {
    q: "iPhone?",
    a: "Native iOS is in build, not ready yet. Tap Get the app on an iPhone (or scan the QR from a desktop) and you'll land on a one-field email form. I'll write to you the day TestFlight opens — not before, and not as a marketing blast.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section
      id="faq"
      className="relative px-5 sm:px-8 py-24 sm:py-36 bg-canvas-2"
    >
      <div className="mx-auto max-w-[1100px]">
        <header className="mb-12 sm:mb-16 max-w-3xl">
          <p className="eyebrow mb-5">Before you ask</p>
          <h2 className="display-2 text-fg text-balance">
            Five{" "}
            <span className="wonk text-fg">honest</span> answers.
          </h2>
        </header>

        <ul
          className="divide-y border-y"
          style={{
            borderColor: "var(--color-rule)",
            ["--tw-divide-y-reverse" as never]: 0,
          }}
        >
          {QS.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={item.q} style={{ borderColor: "var(--color-rule)" }}>
                <button
                  type="button"
                  onClick={() => {
                    const next = isOpen ? null : i;
                    setOpen(next);
                    if (next !== null) track("faq_opened", { question: item.q });
                  }}
                  aria-expanded={isOpen}
                  aria-controls={`faq-${i}`}
                  className="w-full flex items-center justify-between gap-6 py-6 sm:py-8 text-left group"
                >
                  <div className="flex items-baseline gap-4 sm:gap-6 min-w-0 flex-1">
                    <span className="font-mono text-[12px] tracking-[0.18em] uppercase text-fg-subtle shrink-0 mt-1">
                      Q.0{i + 1}
                    </span>
                    <h3 className="display-3 text-fg text-balance flex-1 group-hover:opacity-80 transition-opacity">
                      {item.q}
                    </h3>
                  </div>
                  <span
                    aria-hidden
                    className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                      borderWidth: 1,
                      borderColor: isOpen
                        ? "var(--color-cta-bg)"
                        : "var(--color-rule-strong)",
                      backgroundColor: isOpen
                        ? "var(--color-cta-bg)"
                        : "transparent",
                      color: isOpen
                        ? "var(--color-cta-fg)"
                        : "var(--color-fg)",
                      transform: isOpen ? "rotate(45deg)" : "rotate(0)",
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    >
                      <path d="M12 5 V19 M5 12 H19" />
                    </svg>
                  </span>
                </button>
                <div
                  id={`faq-${i}`}
                  role="region"
                  hidden={!isOpen}
                  className="pl-0 sm:pl-[5.5rem] pb-7 sm:pb-9 max-w-[68ch]"
                >
                  <p className="text-fg-muted/75 text-[1.02rem] leading-[1.65]">
                    {item.a}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
