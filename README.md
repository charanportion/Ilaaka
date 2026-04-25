# Ilaaka

> *Apna Ilaaka. Apni Fitness.* — Your territory. Your fitness.

A location-based fitness territory app for India. Run, walk, or cycle your neighborhood — your GPS trace claims geographic zones that other users can steal back. Strava meets Turfgame, with hyperlocal Indian identity.

## Stack

- **Mobile:** Expo (React Native), TypeScript, MapLibre GL Native
- **Backend:** Supabase (Postgres + PostGIS + h3, Auth, Realtime, Storage, Edge Functions)
- **Auth:** Google OAuth + email/password via Supabase Auth
- **Push:** Expo Push Notifications

See [`docs/architecture.md`](docs/architecture.md) for the full stack rationale.

## Quick start

### Prerequisites

- Node.js 20+ and pnpm (or npm)
- [Supabase CLI](https://supabase.com/docs/guides/cli) — `brew install supabase/tap/supabase`
- Docker Desktop (for local Supabase)
- Expo account (free) — `npm i -g eas-cli`
- A Supabase project (free tier) — create one at supabase.com
- A Google Cloud project for OAuth — see [`docs/auth.md`](docs/auth.md)

### Setup

```bash
git clone <repo> ilaaka
cd ilaaka

# 1. Install dependencies
cd apps/mobile && pnpm install
cd ../..

# 2. Copy env templates
cp apps/mobile/.env.example apps/mobile/.env
cp supabase/.env.example supabase/.env.local
# Fill in the values from your Supabase + GCP dashboards

# 3. Apply migrations to your remote Supabase project
supabase link --project-ref <your-project-ref>
supabase db push

# 4. Deploy Edge Functions
supabase functions deploy submit-activity

# 5. Run the mobile app
cd apps/mobile
npx expo start
```

For background location and native Google Sign-In:
```bash
npx expo prebuild
npx expo run:ios       # or run:android
```

## Documentation

| Document | Read it when |
| --- | --- |
| [`CLAUDE.md`](CLAUDE.md) | Working with Claude Code on this repo |
| [`docs/architecture.md`](docs/architecture.md) | Onboarding, or making cross-cutting tech decisions |
| [`docs/database-schema.md`](docs/database-schema.md) | Touching tables, indexes, RLS, or RPCs |
| [`docs/auth.md`](docs/auth.md) | Working on sign-in, sessions, or OAuth |
| [`docs/zone-capture-pipeline.md`](docs/zone-capture-pipeline.md) | Touching the GPS-trace → zones flow |
| [`docs/mobile-app.md`](docs/mobile-app.md) | Building screens, navigation, GPS, maps |
| [`docs/v0-roadmap.md`](docs/v0-roadmap.md) | Deciding what ships next |

## Status

**v0 — closed beta** (Bengaluru: Koramangala, Indiranagar, HSR). Target: 500 beta users, validating the core capture loop.

See [`docs/v0-roadmap.md`](docs/v0-roadmap.md) for phase-by-phase scope.

## License

Proprietary. © Sri Charan, 2026.
