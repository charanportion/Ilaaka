# Landing page

The marketing site for ilaaka.app. Single-page, mobile-first, optimized for one outcome: **getting the visitor to install the app**. Built to be implemented by Claude Code as a Next.js page.

## Locked decisions

- **Single primary CTA:** "Get the app". Direct route to the install. No forms gating access.
- **Email capture is secondary**, only shown to users on platforms/regions we don't yet support (e.g., iOS users while we're Android-only, non-Hyderabad users in v0).
- **Mobile-first.** 80%+ of traffic from Reels and WhatsApp will be mobile. Desktop is an afterthought.
- **One page, no navigation.** No about page, no blog, no separate features page. Everything on one scroll.
- **Hindi-ready, English-default.** Mark strings with i18n keys; ship English only in v0.

## Why no beta form

For the record, in case future-you is tempted to add one:

- Friction tax kills impulsive installs (the most valuable kind early on).
- TestFlight and Play Internal Testing already gate by email — adding a web form is double-gating.
- Geographic constraints are better handled inside the app with a gracious "we're not in your city yet" screen than at the website gate.
- The job of a v0 landing page is acquisition, not curation.

The single exception: while distribution is TestFlight-only (no Play Store yet), the install button opens a sheet to capture the email, which we manually add to TestFlight. This is *temporary infrastructure*, not a beta-form pattern.

## Tech stack for the landing page

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) | SSR for SEO, image optimization, fast |
| Hosting | Vercel free tier | Generous, zero-config deploys, perfect for marketing pages |
| Domain | ilaaka.app | Already implied; route apex + www |
| Styling | Tailwind CSS v4 | Fast iteration, no design system overhead |
| Analytics | PostHog (same project as the app) | Unified funnel from landing page → install → activation |
| Form backend | A single Supabase table `waitlist` | Reuses existing infrastructure |
| Email capture validation | Zod + simple Next.js Server Action | No need for react-hook-form on a 1-field form |
| Animations | `framer-motion` for the hero map animation, vanilla CSS for the rest | Don't over-engineer |
| Images | next/image with WebP + AVIF | Performance |
| Fonts | Inter (UI), Space Grotesk (display) — both via `next/font` | Free, well-rendered, Indic-friendly fallbacks |

## File structure

```
apps/landing/
├── app/
│   ├── layout.tsx                  # Root layout, fonts, PostHog provider
│   ├── page.tsx                    # The single landing page
│   ├── api/
│   │   └── waitlist/route.ts       # POST waitlist email
│   ├── opengraph-image.tsx         # Generated OG image
│   ├── twitter-image.tsx           # Generated Twitter card
│   ├── favicon.ico
│   └── globals.css
├── components/
│   ├── Hero.tsx                    # Animated map hero
│   ├── HowItWorks.tsx              # 3-step explainer
│   ├── Features.tsx                # Territory, steals, crews, leaderboards
│   ├── ShareSamples.tsx            # Real share-card screenshots
│   ├── FAQ.tsx
│   ├── Footer.tsx
│   ├── InstallButton.tsx           # The single most important component
│   ├── WaitlistSheet.tsx           # iOS / non-Hyderabad email capture
│   └── ui/                         # Button, Input, etc.
├── lib/
│   ├── analytics.ts                # PostHog client
│   ├── supabase.ts                 # Anon-key client for waitlist insert
│   └── platform-detect.ts          # iOS / Android / desktop detection
├── public/
│   ├── og-image.png                # Pre-rendered OG fallback
│   ├── app-screenshots/            # Real screenshots from the app
│   └── share-card-samples/         # 3 example share cards
├── tailwind.config.ts
└── next.config.ts
```

## Content — section by section

### 1. Hero

The hero is the single highest-leverage surface on the page. It must communicate, in under 3 seconds:

- What the app is (a fitness app)
- What's distinctive about it (you claim territory)
- Where it works (Hyderabad, for now)
- That it's available *right now*

**Layout:** Full-viewport on desktop, full-screen on mobile. Background is an animated stylized minimap of Hyderabad with hex zones lighting up in different colors over a 6-second loop. The map is dark, the hexes are vivid (the brand colors). User location dots periodically pulse on. The animation does not loop visibly — it feels alive.

**Headline (H1):**
> Apna Ilaaka. Apni Fitness.

**Subhead:**
> The fitness app where every step claims territory. Walk, run, or cycle your neighborhood — your route locks in colored zones on the map. Friends can steal them back. You walk again to defend.

Translation note: the headline is intentionally Hindi-English mix. It signals localness in 4 words and is more memorable than any pure English alternative. Don't translate it on the English landing page.

**Primary CTA:**
> Get the app

Renders as a large pill button with a Google Play / App Store icon depending on platform detection. Tapping it:
- On Android: deep links to Play Store (or returns email-capture sheet during pure-TestFlight phase).
- On iOS: opens the email-capture sheet to add to TestFlight (during v0); deep links to App Store later.
- On desktop: shows a QR code modal labeled "Scan to install on your phone" with platform tabs.

**Secondary line beneath CTA:**
> Free. Currently in Hyderabad. Android first, iOS soon.

This line manages expectations and pre-empts the "where do I get it" question. Update as platforms launch.

**Trust line at the bottom of the hero:**
> Built in Hyderabad. Private by default — your home address never leaves your device.

Privacy framing matters more in India than most US-centric playbooks suggest. Lead with it, don't bury it.

### 2. How it works

Three steps, horizontally scrollable on mobile, three columns on desktop. Each step has an illustration (a real screenshot from the app, lightly framed in a phone mockup).

**Step 1 — Walk your route.**
> Hit start. Walk, run, or cycle anywhere. We track your route while your phone's in your pocket.

**Step 2 — Claim your zone.**
> The streets you covered turn into colored hexes on the map — your territory, in your color.

**Step 3 — Defend or expand.**
> Friends and rivals can capture your hexes by walking the same streets. Walk back to take them. Every week resets the leaderboard.

The image accompanying step 1 should be a phone mockup with the recorder mid-activity. Step 2 the post-activity card with hexes lit up. Step 3 a notification "Priya captured your zone."

### 3. Features

A four-card grid on desktop, single column on mobile. Each card has an icon, headline, and one-sentence description. No long paragraphs.

**Card 1 — Your real neighborhood, gamified.**
> The map is *your* streets, not a fictional world. Recognize every road you claim.

**Card 2 — Friendly rivalry, not chores.**
> No daily streak guilt-trips. Lose your zone? Get a notification. Walk back when you feel like it.

**Card 3 — Crews.**
> Form a crew with your building, society, or running group. Claim territory together. Cap is 10 for cohesion.

**Card 4 — Privacy by design.**
> Your home is yours. Configure a private radius around your address and your zones there stay invisible to everyone.

These four were chosen because each addresses a likely objection or concern from a skeptical visitor: "is this just another running app" (card 1), "I hate being nagged" (card 2), "I want to play this with my friends" (card 3), "I don't want strangers knowing where I live" (card 4).

### 4. Share samples

A horizontal scrolling band of 3 real share cards from real (or seeded) activities. No copy needed beyond:

> When your run looks this good, you'll want to share it.

Each share card should look like an Instagram Story preview — same aspect ratio, with a faint "shared from Ilaaka" watermark. The user understands instantly that this is shareable content.

### 5. FAQ

Four questions, accordion-style, closed by default. These pre-empt the actual questions you'll get from beta users in the first week.

**Q: Is it free?**
A: Yes, completely free during the beta. No ads, no premium tier yet.

**Q: Does it drain my battery?**
A: We use the same battery-aware GPS APIs Google Maps and Strava use. A 30-minute walk costs about as much battery as a 30-minute call.

**Q: Can I use it outside Hyderabad?**
A: The app works anywhere, but our community is concentrated in Hyderabad right now. If you're elsewhere, drop your city in the email field — we'll let you know when there's a critical mass in your area.

**Q: What about my privacy?**
A: We never sell your location data. You can mark a private radius around your home — zones inside it never appear publicly. Your raw GPS trace is only ever visible to you.

### 6. Founder note

A short, personal section. This is what separates an indie app from a faceless one and converts undecided visitors. Photo + text, left-aligned on desktop.

> Hi, I'm Sri.
>
> I built Ilaaka because the fitness apps I tried felt either chore-like (track everything, hit numbers, never miss a day) or disconnected from the city I actually live in. A run in Jubilee Hills feels different from a run in Banjara Hills — the map should know that.
>
> If you try Ilaaka and something feels off, write to me directly: sri@ilaaka.app. I read every email, and your feedback genuinely changes what I build next.
>
> Apna ilaaka. Apni fitness.
> — Sri

The "I read every email" line is genuinely worth keeping. It's the kind of trust signal you can deliver as a solo founder that no SaaS company can fake.

### 7. Footer

Minimal. Single row.

- Left: small logo + "Built in Hyderabad, 2026"
- Right: Privacy · Terms · Contact

Links open simple text-only legal pages. Don't over-engineer these for v0; they exist for App Store compliance and basic trust.

## The Install Button — implementation detail

This component is referenced everywhere. It's smarter than it looks.

**Behavior:**

```typescript
// pseudocode
function onClick() {
  analytics.capture('install_button_clicked', { platform, location });

  if (platform === 'android' && phase === 'play_store_live') {
    window.location.href = PLAY_STORE_URL;
  }
  else if (platform === 'ios' && phase === 'app_store_live') {
    window.location.href = APP_STORE_URL;
  }
  else if (platform === 'desktop') {
    showQRCodeModal();
  }
  else {
    // Pre-launch on this platform — capture email
    showWaitlistSheet({ context: platform === 'ios' ? 'ios_waitlist' : 'android_waitlist' });
  }
}
```

The phase variable comes from a single config file (`config/launch-phases.ts`). When you launch on Play Store, you flip a flag in that file and redeploy — no code change. When you launch on App Store, same. This keeps the launch coordination simple.

**Visual states:**
- Default: "Get the app" + platform icon
- During click (sub-100ms): subtle scale-down, haptic on mobile via `navigator.vibrate(10)`
- On QR modal open: button text shifts to "Scan to install"
- On waitlist sheet open: button text shifts to "Join waitlist"

## The Waitlist Sheet

Used only when the user's platform/region isn't supported yet. Single field, single CTA.

**Headline (varies by context):**
- iOS waitlist: "Coming to iOS soon."
- Outside Hyderabad: "We're starting in Hyderabad."

**Subhead:**
> Drop your email and we'll let you know the moment it's live for you.

**Field:** email, with optional second field for "Your city" if context is outside-Hyderabad.

**CTA:** "Notify me"

**Stored in Supabase table:**

```sql
create table public.waitlist (
  id           bigint generated always as identity primary key,
  email        text not null,
  city         text,
  context      text not null,    -- 'ios_waitlist' | 'outside_hyderabad' | 'general'
  source       text,             -- referrer or utm_source if available
  created_at   timestamptz not null default now(),
  unique (email, context)
);

alter table public.waitlist enable row level security;
-- No SELECT policy for anon; admin reads via service role only.
create policy "waitlist_insert_anon" on public.waitlist
  for insert to anon with check (true);
```

After submission, show a thank-you state. Don't redirect, don't auto-close — let them dismiss it.

## SEO and meta

```typescript
// app/layout.tsx (excerpt)
export const metadata = {
  title: 'Ilaaka — Apna Ilaaka. Apni Fitness.',
  description: 'The fitness app where every step claims territory. Walk, run, or cycle your neighborhood — your route locks in colored zones on the map.',
  keywords: ['fitness app India', 'territory game', 'running app Hyderabad', 'walk tracker', 'social fitness'],
  openGraph: {
    title: 'Ilaaka — Claim your neighborhood',
    description: 'The fitness app where every step claims territory.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    locale: 'en_IN',
    siteName: 'Ilaaka',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ilaaka — Claim your neighborhood',
    description: 'Walk, run, or cycle. Your route claims territory.',
    images: ['/twitter-image.png'],
  },
};
```

**OG image content:** dark background, colored hexes covering a stylized Hyderabad minimap, tagline "Apna Ilaaka. Apni Fitness." in large display type, app icon top-right. Generate this once via Figma; don't try to do it dynamically in v0.

## Analytics events to fire

```typescript
analytics.capture('landing_page_viewed', { referrer, utm_source });
analytics.capture('hero_animation_completed');         // they stayed past the 6-sec loop
analytics.capture('section_in_view', { section });     // intersection observer per major section
analytics.capture('install_button_clicked', { platform, button_location });
analytics.capture('qr_modal_opened');
analytics.capture('waitlist_sheet_opened', { context });
analytics.capture('waitlist_submitted', { context, has_city });
analytics.capture('faq_opened', { question });
```

Tie the PostHog distinct ID to the user's eventual app signup via the email — if the same email shows up in `waitlist` and later in `auth.users`, merge the two timelines. This gives you the full picture from first visit to first activity.

The conversion funnel that matters:

```
landing_page_viewed → install_button_clicked → app_signup → first_activity_completed
```

Track conversion rate at each step. The biggest drop-off is your highest-leverage fix, same as in-app onboarding.

## Performance budget

Hard targets, enforced via Vercel Speed Insights:

- LCP under 2.0s on a Moto G4-class device on 4G
- Total page weight under 800KB on first paint
- Hero map animation under 200KB (compress aggressively)
- Zero blocking third-party scripts above the fold (PostHog loads after first paint)

A landing page that takes 5 seconds to load on a JioFi connection in a Hyderabad suburb is worse than no landing page. Measure on real Indian network conditions, not your home wifi.

## Implementation order

**Day 1:** Next.js scaffold, Tailwind, fonts, PostHog wired. Deploy a placeholder "coming soon" version to ilaaka.app to start indexing.

**Day 2:** Hero with static (non-animated) map background, install button with all platform branches, waitlist sheet, Supabase waitlist table.

**Day 3:** How It Works, Features, FAQ sections. Real screenshots from the app.

**Day 4:** Hero map animation, founder note section, share samples band, footer.

**Day 5:** OG images, meta tags, performance pass, mobile QA on real devices, accessibility pass (semantic HTML, alt text, contrast).

**Day 6:** Soft launch — share with 10 friends, watch their session recordings on PostHog, fix the obvious issues.

**Day 7:** Public.

## Definition of done

A new visitor on a mid-range Android phone on 4G in Hyderabad can:

1. Open ilaaka.app in under 2 seconds.
2. Understand what the app is in under 5 seconds of looking at the hero.
3. Tap "Get the app" and either install (when the store is live) or capture their email (in pre-launch).
4. Skim the rest of the page and have their three most likely questions answered without scrolling back.
5. Trust enough to actually install.

PostHog confirms 30%+ of `landing_page_viewed` events lead to `install_button_clicked`. That's the bar for v0.5.

## Future — what to add post-launch

- **Press / coverage section** once you have any (even a tweet from someone known).
- **Live user count widget** ("847 walkers in Hyderabad") once the number is impressive enough to brag about.
- **Locality-specific landing pages** (`ilaaka.app/koramangala`) for hyperlocal sharing — same content, different hero locality name.
- **Hindi version** behind a `/hi` route. Same content, translated, tested with native readers.
- **Founder video** — 30-second clip of you walking and the territory filling in. Embed above the fold once you have it produced well enough.

Don't build any of these in v0. The core landing page is enough to validate that visitors convert at all. Everything else is optimization on top.