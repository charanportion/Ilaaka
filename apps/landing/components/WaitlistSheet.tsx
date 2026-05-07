"use client";

import { useEffect, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics";

export type WaitlistContext =
  | "ios_waitlist"
  | "outside_hyderabad"
  | "general";

const HEADLINES: Record<WaitlistContext, { title: string; sub: string }> = {
  ios_waitlist: {
    title: "Not on iOS yet.",
    sub: "We haven't shipped to the App Store. Drop your email and we'll ping you the day it lands.",
  },
  outside_hyderabad: {
    title: "We're starting in Hyderabad.",
    sub: "Tell us your city — we'll let you know when there are enough walkers nearby to make it fun.",
  },
  general: {
    title: "Get notified.",
    sub: "Drop your email and we'll let you know the moment it's live for you.",
  },
};

type Props = {
  open: boolean;
  context: WaitlistContext;
  onClose: () => void;
};

export function WaitlistSheet({ open, context, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showCity = context === "outside_hyderabad";
  const headline = HEADLINES[context];

  useEffect(() => {
    if (!open) return;
    track("waitlist_sheet_opened", { context });
    setEmail("");
    setCity("");
    setError(null);
    setDone(false);
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, context, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("That doesn't look like a valid email.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, city: showCity ? city : undefined, context }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Something went wrong. Try again?");
      }
      track("waitlist_submitted", { context, has_city: !!city });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center"
    >
      <button
        aria-label="Close waitlist sheet"
        onClick={onClose}
        className="absolute inset-0 backdrop-blur-md"
        style={{ backgroundColor: "color-mix(in oklab, var(--color-canvas) 75%, transparent)" }}
      />
      <div
        ref={dialogRef}
        className="relative card-surface w-full sm:max-w-[460px] mx-0 sm:mx-4 rounded-t-[28px] sm:rounded-[28px] p-7 sm:p-9 animate-tick-up"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 rounded-full grid place-items-center transition-colors text-fg-muted/70 hover:text-fg"
          style={{ borderWidth: 1, borderColor: "var(--color-rule)" }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M5 5 L19 19 M5 19 L19 5" />
          </svg>
        </button>

        {!done ? (
          <>
            <p className="eyebrow mb-4">Waitlist</p>
            <h3 id={titleId} className="display-3 text-fg max-w-[20ch] text-balance">
              {headline.title}
            </h3>
            <p className="mt-3 text-fg-muted/75 text-[0.98rem] leading-[1.55]">
              {headline.sub}
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-3">
              <label className="block">
                <span className="sr-only">Email</span>
                <input
                  ref={inputRef}
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl px-5 py-4 font-body text-[1rem] focus:outline-none focus:ring-0"
                  style={{
                    backgroundColor: "var(--color-surface-2)",
                    borderWidth: 1,
                    borderColor: "var(--color-rule)",
                    color: "var(--color-fg)",
                  }}
                />
              </label>
              {showCity && (
                <label className="block">
                  <span className="sr-only">City</span>
                  <input
                    type="text"
                    autoComplete="address-level2"
                    placeholder="Your city (optional)"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-2xl px-5 py-4 font-body text-[1rem] focus:outline-none"
                    style={{
                      backgroundColor: "var(--color-surface-2)",
                      borderWidth: 1,
                      borderColor: "var(--color-rule)",
                      color: "var(--color-fg)",
                    }}
                  />
                </label>
              )}
              {error && (
                <p
                  className="font-mono text-[12px] pl-3 py-1 text-fg"
                  style={{ borderLeft: "2px solid var(--color-fg)" }}
                >
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="btn-pill btn-primary w-full justify-center"
              >
                {submitting ? "Sending…" : "Notify me"}
                <span className="opacity-70">→</span>
              </button>
            </form>
            <p className="mt-4 font-mono text-[10.5px] tracking-[0.16em] uppercase text-fg-subtle">
              We'll only email you about the launch.
            </p>
          </>
        ) : (
          <div className="text-center py-6">
            <span
              className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-5"
              style={{
                backgroundColor: "var(--color-cta-bg)",
                color: "var(--color-cta-fg)",
                boxShadow:
                  "0 0 30px color-mix(in oklab, var(--color-cta-bg) 35%, transparent)",
              }}
            >
              <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12 L10 17 L19 7" />
              </svg>
            </span>
            <h3 className="display-3 text-fg">You're on the list.</h3>
            <p className="mt-3 text-fg-muted/75 max-w-[34ch] mx-auto">
              We'll write to <span className="text-fg">{email}</span>{" "}
              the moment it's live.
            </p>
            <button
              onClick={onClose}
              className="btn-pill btn-ghost mt-7 mx-auto"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
