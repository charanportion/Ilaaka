"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

const QS = [
  {
    q: "Is it free?",
    a: "Yes, completely free during the beta. No ads, no premium tier yet.",
  },
  {
    q: "Does it drain my battery?",
    a: "We use the same battery-aware GPS APIs Google Maps and Strava use. A 30-minute walk costs about as much battery as a 30-minute call.",
  },
  {
    q: "Can I use it outside Hyderabad?",
    a: "The app works anywhere, but our community is concentrated in Hyderabad right now. If you're elsewhere, drop your city in the email field — we'll let you know when there's a critical mass in your area.",
  },
  {
    q: "What about my privacy?",
    a: "We never sell your location data. You can mark a private radius around your home — zones inside it never appear publicly. Your raw GPS trace is only ever visible to you.",
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
            Four{" "}
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
