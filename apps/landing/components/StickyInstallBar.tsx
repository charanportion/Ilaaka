"use client";

import { useEffect, useState } from "react";
import { InstallButton } from "./InstallButton";

type Props = {
  onOpenWaitlist: (context: "ios_waitlist") => void;
  onOpenQr: () => void;
};

/**
 * Mobile-only sticky CTA that fades in once the user has scrolled past
 * the hero. The hero CTA stays the visual hero — this is the safety net.
 */
export function StickyInstallBar({ onOpenWaitlist, onOpenQr }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShow(window.scrollY > window.innerHeight * 0.85);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!show}
      className="sm:hidden fixed inset-x-3 z-40 transition-all duration-300"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(120%)",
      }}
    >
      <div className="card-surface px-3 py-3 flex items-center gap-3">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-muted/70 px-2 shrink-0">
          ilaaka
        </span>
        <span
          className="block flex-1 h-px"
          style={{ backgroundColor: "var(--color-rule)" }}
        />
        <InstallButton
          location="sticky"
          size="md"
          onOpenWaitlist={onOpenWaitlist}
          onOpenQr={onOpenQr}
        />
      </div>
    </div>
  );
}
