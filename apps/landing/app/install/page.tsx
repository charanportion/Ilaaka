import type { Metadata } from "next";
import { AutoDownload } from "@/components/install/AutoDownload";
import { InstallSteps } from "@/components/install/InstallSteps";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Install Ilaaka — Android",
  description:
    "Direct APK install for Ilaaka. Auto-downloads on Android with step-by-step install instructions.",
  alternates: { canonical: "https://ilaaka.dotportion.com/install" },
  robots: { index: false, follow: true },
};

export default function InstallPage() {
  return (
    <main className="relative min-h-screen flex flex-col">
      <section className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-16 flex flex-col gap-10">
        <header className="flex items-center justify-between">
          <a href="/" className="font-mono text-[12px] tracking-[0.22em] uppercase text-fg-muted/80 hover:text-fg transition-colors">
            ← Ilaaka
          </a>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-subtle">
            Hyderabad · Beta
          </span>
        </header>

        <AutoDownload />

        <div className="flex flex-col gap-4">
          <p className="eyebrow">Installing</p>
          <InstallSteps />
        </div>

        <p className="text-fg-muted/70 text-[0.88rem] leading-relaxed max-w-[60ch]">
          Ilaaka is distributed as a direct APK while we{"'"}re in closed beta.
          The Play Store listing comes once we open up the waitlist. Questions
          or trouble installing? Reach out from the home page.
        </p>
      </section>

      <Footer />
    </main>
  );
}
