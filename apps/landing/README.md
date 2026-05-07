# Ilaaka — Landing Page (`apps/landing`)

The marketing site for **ilaaka.app**. Single-page, mobile-first, optimised
for one outcome: getting the visitor to install the app.

## Aesthetic — "Streetlight Cartography"

- Warm-black canvas with sodium-saffron primary, phosphor-lime fresh-capture
  accent, and electric-magenta for stolen turf.
- Hexagons as a recurring rhythm (animated hex map in hero, hex-tile bullets,
  hex pattern in cards) — never literal, always implied.
- Fonts: **Fraunces** (display, with SOFT/WONK axes for character),
  **Manrope** (body), **JetBrains Mono** (eyebrows + stats).
- Asymmetric editorial layouts; one big animated hero moment; restrained
  micro-interactions elsewhere.

> Note: the landing-page brief in `docs/landing.md` originally specified
> Inter + Space Grotesk. The frontend-design skill explicitly rules out
> those two fonts as overused; Fraunces + Manrope render just as well with
> Indic fallbacks and give the page a stronger, more local point-of-view.
> Easy to swap back if you prefer.

## Run

```bash
cd apps/landing
pnpm install        # or npm / yarn / bun
pnpm dev            # http://localhost:3001
```

## Env

Copy `.env.example` to `.env.local`. Without `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` the waitlist API logs to the server console
instead of writing to `public.waitlist` — useful for first-day iteration.

## Launch phase flags

`lib/launch-phases.ts` is the single source of truth for whether the install
button deep-links to a store or opens the email-capture sheet. Flip and
redeploy when stores go live.

## Routes

- `/` — the landing page
- `POST /api/waitlist` — Zod-validated email capture, writes to Supabase
  `public.waitlist` (insert-only RLS).

## What's intentionally not in v0

- Press / coverage section
- Live user-count widget
- Locality landing pages (`/koramangala` etc.)
- Hindi `/hi` route
- Founder video
