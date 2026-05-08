import type { Metadata } from "next";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — Ilaaka",
  description:
    "What data Ilaaka collects, why, who else sees it, and how to delete it. Plain English.",
  alternates: { canonical: "https://ilaaka.dotportion.com/privacy" },
  robots: { index: true, follow: true },
};

const EFFECTIVE_DATE = "8 May 2026";
const CONTACT_EMAIL = "sricharan.rayala@dotportion.com";

export default function PrivacyPage() {
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
            Privacy <span className="wonk text-fg">policy.</span>
          </h1>
          <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-fg-subtle">
            Effective {EFFECTIVE_DATE}
          </p>
        </div>

        <Prose>
          <p>
            This is the policy for the Ilaaka mobile app and the website at
            ilaaka.dotportion.com. It is written to be readable. If anything
            here is unclear, write to{" "}
            <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>{" "}
            and I will rewrite it.
          </p>

          <H2>Who we are</H2>
          <p>
            Ilaaka is built and operated by dotportion, based in Hyderabad,
            India. For this policy and the Digital Personal Data Protection
            Act, 2023 (DPDPA), dotportion is the Data Fiduciary. Sri Charan
            Rayala is the founder and the named Grievance Officer.
          </p>

          <H2>What we collect</H2>
          <ul>
            <li>
              <strong>Account.</strong> Your email address, and either a
              password or a Google OAuth identifier — whichever you sign in
              with. We never see your Google password.
            </li>
            <li>
              <strong>Profile.</strong> Username, display name, optional
              avatar, your chosen zone colour, the city and locality you
              entered during onboarding, and the answers you gave to the
              onboarding questions (activity type, motivation, frequency,
              time-of-day preference). All of these are editable from the
              profile screen.
            </li>
            <li>
              <strong>GPS traces.</strong> While a walk, run, or cycle is
              recording, we capture latitude, longitude, accuracy, and
              altitude samples, plus the start and end timestamps. We capture
              this both while the app is in the foreground and while it is in
              the background — Android shows a persistent notification while
              recording, so this never happens silently.
            </li>
            <li>
              <strong>Activity photos.</strong> Photos you choose to attach
              to a saved activity. You decide which ones to attach; you can
              delete them later.
            </li>
            <li>
              <strong>Social signals.</strong> Who you follow, who follows
              you, and any likes or comments you leave on activities visible
              to you.
            </li>
            <li>
              <strong>Device tokens.</strong> An Expo push token tied to your
              account so we can send you notifications about zones being
              captured, weekly stats, and friend activity.
            </li>
            <li>
              <strong>Diagnostics.</strong> Crash reports and product-usage
              events (which screens were opened, which buttons were tapped).
              These never contain your raw GPS coordinates — that is a hard
              rule on our side.
            </li>
          </ul>

          <H2>Why we collect each thing</H2>
          <p>
            Account and profile data exists so you can sign in and so other
            users can find and follow you. GPS traces are the entire point of
            the product — without them there is no zone capture. Photos and
            social signals make the activity feed worth opening. Push tokens
            let us tell you when someone steals your zone. Diagnostics help
            us fix bugs and decide what to build next.
          </p>
          <p>
            Under DPDPA, the lawful basis for almost everything we do is your
            consent. You consent by signing up and by granting the location
            permission. Crash reports also fall under our legitimate interest
            in keeping the app working.
          </p>

          <H2>The privacy radius around your home</H2>
          <p>
            You can configure a private radius around your home. Zones inside
            that radius are invisible on the public map — to friends, to
            strangers, to leaderboards. The raw trace is still stored on your
            account so your distance and route history stay accurate, but
            nobody else sees what streets you walked there.
          </p>

          <H2>Who else sees your data</H2>
          <p>
            We share data only with the service providers we need to run the
            app. Each is a sub-processor under DPDPA, and each gets only what
            it needs to do its job:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> — hosts our Postgres database, file
              storage, and the server functions that process activities. All
              the data described above is stored here.
            </li>
            <li>
              <strong>Mapbox</strong> — receives the GPS coordinates of an
              activity for the snap-to-road step that cleans up GPS jitter.
              Mapbox sees the coordinates of the route only; it does not see
              your name, email, or account ID.
            </li>
            <li>
              <strong>Expo</strong> — receives your push token and the body
              of any notification we send to your device.
            </li>
            <li>
              <strong>PostHog</strong> — receives product-analytics events
              (screen views, button taps) and your account ID. No GPS, no
              email, no photos.
            </li>
            <li>
              <strong>Sentry</strong> — receives crash reports and the
              technical context around them. No GPS, no email, no photos.
            </li>
            <li>
              <strong>Google</strong> — only if you sign in with Google.
              Google sees that you signed in to Ilaaka and shares your name,
              email, and profile picture with us.
            </li>
          </ul>
          <p>
            We do not sell your data. We do not share it with advertisers. We
            have no advertising on the app, and no plans to add it.
          </p>

          <H2>Where your data lives</H2>
          <p>
            Most of our infrastructure runs on cloud regions outside India.
            Under DPDPA your data may therefore be transferred outside India
            for processing. The companies above all publish their own privacy
            and security commitments which we rely on.
          </p>

          <H2>How long we keep things</H2>
          <ul>
            <li>
              <strong>Zones on the public map</strong> expire 14 days after
              the last walk through them.
            </li>
            <li>
              <strong>Your activities, photos, comments, and zone history</strong>{" "}
              stay until you delete them or you delete your account.
            </li>
            <li>
              <strong>Your account and profile</strong> stay until you ask us
              to delete them.
            </li>
            <li>
              <strong>Crash reports and analytics events</strong> are kept on
              a rolling 90-day window.
            </li>
          </ul>

          <H2>Your rights</H2>
          <p>
            You can sign in and edit your profile, change your colour, change
            your privacy radius, and delete individual activities at any
            time. To export everything we hold about you, to correct it, or
            to erase your account entirely, write to{" "}
            <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>{" "}
            from the email address on your account. We will respond within
            seven days.
          </p>
          <p>
            You can withdraw your consent for processing at any time by
            asking us to delete your account. After erasure we keep only the
            minimum we are legally required to keep — typically nothing.
          </p>

          <H2>Children</H2>
          <p>
            Ilaaka is not for users under 18. Under DPDPA we do not knowingly
            process the personal data of children. If you believe a child has
            created an account, please write to us and we will remove it.
          </p>

          <H2>Security</H2>
          <p>
            Database access is gated by row-level security: no user can read
            another user&apos;s raw GPS trace. All traffic is HTTPS. The
            Supabase service-role key — the one with full database access —
            never leaves the server.
          </p>

          <H2>Changes to this policy</H2>
          <p>
            If we change this policy materially, we will update the effective
            date at the top and, where appropriate, send you a notification
            in the app. Smaller wording fixes do not get an announcement.
          </p>

          <H2>Grievance Officer</H2>
          <p>
            Under DPDPA, you have the right to escalate concerns to a named
            officer at our company.
          </p>
          <p>
            <strong>Sri Charan Rayala</strong>
            <br />
            Founder, dotportion · Hyderabad, India
            <br />
            <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>
          </p>
          <p>
            If you are not satisfied with our response, you may complain to
            the Data Protection Board of India.
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
