import type { Metadata } from "next";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service — Ilaaka",
  description:
    "The rules for using Ilaaka. Beta status, anti-cheat, content rules, governing law.",
  alternates: { canonical: "https://ilaaka.dotportion.com/terms" },
  robots: { index: true, follow: true },
};

const EFFECTIVE_DATE = "8 May 2026";
const CONTACT_EMAIL = "sricharan.rayala@dotportion.com";

export default function TermsPage() {
  return (
    <main className="relative min-h-screen flex flex-col">
      <section className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-16 flex flex-col gap-10">
        <header className="flex items-center justify-between">
          <a
            href="/"
            className="font-mono text-[12px] tracking-[0.22em] uppercase text-fg-muted/80 hover:text-fg transition-colors"
          >
            ← Ilaaka
          </a>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-subtle">
            Hyderabad · Beta
          </span>
        </header>

        <div className="flex flex-col gap-4">
          <p className="eyebrow">Legal</p>
          <h1 className="display-2 text-fg text-balance">
            Terms of <span className="wonk text-fg">service.</span>
          </h1>
          <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-fg-subtle">
            Effective {EFFECTIVE_DATE}
          </p>
        </div>

        <Prose>
          <p>
            These are the rules for using Ilaaka — the mobile app and the
            website at ilaaka.dotportion.com. By creating an account or
            installing the app, you agree to them. If you don&apos;t, please
            don&apos;t use the service.
          </p>

          <H2>Who you&apos;re agreeing with</H2>
          <p>
            Ilaaka is operated by dotportion, based in Hyderabad, India. In
            these terms, &ldquo;we&rdquo; and &ldquo;us&rdquo; mean
            dotportion. &ldquo;You&rdquo; means whoever is using the app or
            the site.
          </p>

          <H2>Eligibility</H2>
          <p>
            You must be 18 or older to use Ilaaka. One person, one account.
            You&apos;re responsible for everything that happens under your
            account, so keep your sign-in details to yourself.
          </p>

          <H2>This is a beta</H2>
          <p>
            Ilaaka is in early beta. Features will change, occasionally
            break, and sometimes disappear. The app is currently free; we
            reserve the right to introduce paid features in the future, but
            anything you have at the moment of that change will keep working
            on at least the existing free terms.
          </p>

          <H2>How to play it straight</H2>
          <p>
            The whole product is built on the assumption that the GPS trace
            represents an actual walk, run, or cycle. Anything that breaks
            that assumption breaks the game for everyone else. So:
          </p>
          <ul>
            <li>
              No claiming territory by car, scooter, auto, or any other
              vehicle. The server already filters out vehicular-shaped
              traces; doing it deliberately is grounds for losing the
              account.
            </li>
            <li>
              No GPS spoofing, no fake location apps, no replaying old
              traces.
            </li>
            <li>
              No multiple accounts to feed each other zones.
            </li>
            <li>
              No scraping, reverse engineering, or hammering our servers with
              automated requests.
            </li>
          </ul>

          <H2>What you post</H2>
          <p>
            Activity titles, descriptions, photos, and comments are all user
            content. You keep ownership of what you upload. You give us a
            non-exclusive licence to store it, process it, and show it to
            other Ilaaka users in the contexts the app is designed for —
            your activity feed, your profile, the public map.
          </p>
          <p>
            You promise that what you upload is yours to upload, and that it
            doesn&apos;t:
          </p>
          <ul>
            <li>contain explicit or sexual content,</li>
            <li>show identifiable strangers without their consent,</li>
            <li>harass, threaten, or abuse another person,</li>
            <li>contain hate speech or content unlawful under Indian law,</li>
            <li>impersonate someone else.</li>
          </ul>
          <p>
            We can remove content that breaks these rules, and we can
            suspend or delete accounts that repeatedly do.
          </p>

          <H2>Privacy</H2>
          <p>
            What data we collect, why, and what we do with it lives in the{" "}
            <Link href="/privacy">privacy policy</Link>. Read it — it&apos;s
            short and it matters.
          </p>

          <H2>Suspending or closing your account</H2>
          <p>
            You can delete your account any time by writing to{" "}
            <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>{" "}
            from the email on your account. We can suspend or close an
            account if it breaks these terms, and we&apos;ll explain why
            unless we&apos;re legally barred from doing so.
          </p>

          <H2>The map and the world</H2>
          <p>
            Ilaaka shows you a map of public roads and is designed for
            walking and running on safe footpaths. You&apos;re responsible
            for your own safety: watch the road, not the screen, and
            don&apos;t walk into traffic chasing a zone. We&apos;re not
            liable for what happens to you while you&apos;re moving.
          </p>

          <H2>No warranty</H2>
          <p>
            Ilaaka is provided &ldquo;as is&rdquo;. We do our best to keep it
            accurate, available, and fast, but we don&apos;t promise it will
            always work, that the data will always be correct, or that any
            specific zone will be claimable at any specific time.
          </p>

          <H2>Limit of liability</H2>
          <p>
            To the extent allowed by Indian law, our total liability to you
            for anything connected with Ilaaka is capped at INR 1,000 or the
            amount you have paid us in the past twelve months — whichever is
            higher. We&apos;re not liable for indirect or consequential
            losses (lost data, lost time, lost streaks, lost zones).
          </p>

          <H2>Changes to these terms</H2>
          <p>
            If we change these terms materially, we&apos;ll update the
            effective date at the top and, where appropriate, notify you in
            the app. Continued use after a change means you accept the new
            version.
          </p>

          <H2>Governing law</H2>
          <p>
            These terms are governed by the laws of India. Any dispute
            arising out of or in connection with them is subject to the
            exclusive jurisdiction of the courts at Hyderabad, Telangana.
          </p>

          <H2>Contact</H2>
          <p>
            For anything — bugs, complaints, account questions, or just to
            say something works:{" "}
            <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
          </p>
        </Prose>
      </section>

      <Footer />
    </main>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <article className="legal-prose flex flex-col gap-5 text-fg-muted/85 text-[1rem] leading-[1.7] max-w-[68ch]">
      {children}
    </article>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[1.5rem] sm:text-[1.7rem] leading-tight text-fg mt-8 -mb-1">
      {children}
    </h2>
  );
}

function Link({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="text-fg underline decoration-dotted underline-offset-4 hover:opacity-70 transition-opacity"
    >
      {children}
    </a>
  );
}
