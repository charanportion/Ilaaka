"use client";

import { useEffect, useState } from "react";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Features } from "@/components/Features";
import { ShareSamples } from "@/components/ShareSamples";
import { FAQ } from "@/components/FAQ";
import { FounderNote } from "@/components/FounderNote";
import { Footer } from "@/components/Footer";
import { WaitlistSheet, type WaitlistContext } from "@/components/WaitlistSheet";
import { QrModal } from "@/components/QrModal";
import { StickyInstallBar } from "@/components/StickyInstallBar";
import { track } from "@/lib/analytics";

export default function HomePage() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistCtx, setWaitlistCtx] = useState<WaitlistContext>("general");
  const [qrOpen, setQrOpen] = useState(false);

  function openWaitlist(ctx: "ios_waitlist") {
    setWaitlistCtx(ctx);
    setWaitlistOpen(true);
  }

  function openQr() {
    track("qr_modal_opened");
    setQrOpen(true);
  }

  useEffect(() => {
    track("landing_page_viewed", {
      referrer: typeof document !== "undefined" ? document.referrer : "",
    });
  }, []);

  return (
    <main className="relative">
      <Hero onOpenWaitlist={openWaitlist} onOpenQr={openQr} />
      <HowItWorks />
      <Features />
      <ShareSamples />
      <FAQ />
      <FounderNote onOpenWaitlist={openWaitlist} onOpenQr={openQr} />
      <Footer />

      <StickyInstallBar onOpenWaitlist={openWaitlist} onOpenQr={openQr} />

      <WaitlistSheet
        open={waitlistOpen}
        context={waitlistCtx}
        onClose={() => setWaitlistOpen(false)}
      />
      <QrModal open={qrOpen} onClose={() => setQrOpen(false)} />
    </main>
  );
}
