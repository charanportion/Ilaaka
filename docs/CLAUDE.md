# Ilaaka — Claude Code Guide

You are working on **Ilaaka**, a location-based fitness territory app for the Indian market. Users run, walk, or cycle, and the GPS trace claims geographic territory ("zones") that other users can steal back. Read this file every session.

## Stack (locked)

| Layer | Tech |
| --- | --- |
| Mobile | Expo (React Native), TypeScript, Expo Router |
| State | Zustand |
| Maps | MapLibre GL Native (`@maplibre/maplibre-react-native`), OSM tiles |
| Backend | Supabase (Postgres + PostGIS + h3 extensions, Auth, Realtime, Storage, Edge Functions) |
| Auth | Supabase Auth — Google OAuth + email/password (no phone OTP in v0) |
| DB client | `@supabase/supabase-js` directly. No ORM. Spatial queries via Postgres RPC functions. |
| Async jobs | V0: synchronous Edge Functions. V1+: Inngest. |
| Push | Expo Push Notifications |
| Storage | Supabase Storage (1 GB free), migrate to R2 if needed |
| Analytics | PostHog (free tier) |
| Errors | Sentry (free tier) |

## Folder structure

```
ilaaka/
├── CLAUDE.md                          # This file
├── README.md
├── docs/
│   ├── architecture.md
│   ├── database-schema.md
│   ├── auth.md
│   ├── zone-capture-pipeline.md
│   ├── mobile-app.md
│   └── v0-roadmap.md
├── apps/
│   └── mobile/                        # Expo app
│       ├── app/                       # Expo Router routes
│       ├── components/
│       ├── lib/                       # supabase client, helpers
│       ├── stores/                    # Zustand stores
│       ├── types/
│       └── app.json
└── supabase/
    ├── migrations/                    # SQL migration files
    └── functions/                     # Deno Edge Functions
        └── submit-activity/
```

## Conventions

- **File naming:** kebab-case (`zone-capture.ts`, `activity-recorder.tsx`)
- **SQL identifiers:** snake_case (`zone_ownership`, `captured_at`)
- **TS variables:** camelCase. **Types/components:** PascalCase.
- **Imports:** absolute via `@/` alias from `apps/mobile/`.
- **No default exports** for components — named exports only. Default exports are reserved for Expo Router screens (the framework requires them).
- **Async/await everywhere.** No `.then()` chains in new code.
- **Zod** for all runtime input validation (Edge Function bodies, untrusted data).

## Hard rules — never violate

1. **Row Level Security (RLS) is on for every user-data table.** No exceptions. If you create a table, write the policies in the same migration.
2. **No client-side spatial computation.** GPS trace → polygon → H3 cells happens server-side only. The client uploads raw GPS and reads back computed zones.
3. **Service role key never leaves the server.** Only Edge Functions use it. The mobile app uses the anon key + the user's JWT.
4. **No raw GPS in logs.** Sentry, console, PostHog — none of them ever see lat/lng. Privacy is non-negotiable.
5. **No `select *` over user-data tables in production code.** Explicit columns only — protects against schema-leak when columns get added.
6. **Coordinates are always (lng, lat) in code and PostGIS.** It's `ST_MakePoint(lng, lat)`, in that order. The number of bugs caused by reversing this is uncountable.
7. **All money math in paise (integer), never rupees (float).** Even though there's no payment in v0, set the convention now.

## H3 + spatial settings (locked)

- **H3 resolution: 11** (~1,770 sqm hex, ~25m edge). Stored as `BIGINT`.
- **Minimum capture: 3 H3 cells** (≈ 5,000 sqm). Anything smaller is rejected.
- **Zone expiry: 14 days** since last activity in that cell.
- **PostGIS SRID: 4326** (WGS84) for storage. Reproject only for area calculations.

## Common commands

```bash
# Mobile dev
cd apps/mobile
pnpm install
npx expo start                          # Expo Go for fast iteration (no native modules)
npx expo run:ios                        # Dev build (required for native Google Sign-In, expo-location background)
npx expo run:android

# Supabase
supabase start                          # Local dev stack (Docker)
supabase db reset                       # Apply all migrations to local DB
supabase migration new <name>           # Scaffold a new migration
supabase db push                        # Push migrations to remote project
supabase functions deploy submit-activity
supabase functions serve submit-activity --env-file ./supabase/.env.local
```

## Environment variables

Mobile app — `apps/mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_POSTHOG_API_KEY=
EXPO_PUBLIC_SENTRY_DSN=
```

Edge Functions — `supabase/.env.local`:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
EXPO_ACCESS_TOKEN=
```

## Gotchas

- **Google OAuth on Expo:** the polished native flow needs a dev build, not Expo Go. For first-day iteration use `signInWithOAuth` with deep-link redirect; switch to `signInWithIdToken` (via `@react-native-google-signin/google-signin`) once you've prebuilt. See `docs/auth.md`.
- **MapLibre vs Mapbox:** they share the same vector-tile spec but are *different libraries*. Always reach for `@maplibre/maplibre-react-native`. Never `@rnmapbox/maps` — that's the paid Mapbox SDK and its API differs.
- **Expo Go can't do background location.** When you wire up real GPS tracking with `foregroundService` / `background` permissions, prebuild is mandatory.
- **Supabase free-tier pause:** projects pause after 7 days of zero DB activity. Once real users exist, this never triggers. During quiet build periods, set up a daily ping (cron-job.org or GH Actions) hitting the project URL.
- **Edge Function timeouts:** 60s wall-clock on Supabase. Sync zone computation should finish well under this for any normal activity. If it doesn't, the trace is too dense — simplify aggressively before computing.
- **PostGIS coordinate order:** GeoJSON is `[lng, lat]`. PostGIS `ST_MakePoint(x, y)` is `(lng, lat)`. Leaflet/MapLibre often display as `[lat, lng]`. Pick one direction at the boundary and stick to it. We use `[lng, lat]` everywhere internally.

## Where to look for what

- **Architecture & request flow:** `docs/architecture.md`
- **DB schema, indexes, RLS, RPCs:** `docs/database-schema.md`
- **Auth setup, Google OAuth, sign-in code:** `docs/auth.md`
- **The zone capture algorithm:** `docs/zone-capture-pipeline.md`
- **Mobile app structure, screens, GPS:** `docs/mobile-app.md`
- **What to build in what order:** `docs/v0-roadmap.md`

## Definition of done for any feature

A feature is done when:
1. Migration runs cleanly on `supabase db reset`.
2. RLS policies are written and tested (a user can't see other users' raw activities).
3. Mobile flow works on a physical Android device (the iOS sim is not enough — GPS needs real hardware).
4. PostHog event(s) for the feature are firing.
5. Sentry captures errors from both the Edge Function and the mobile screen.
6. There's at least one happy-path test for any non-trivial pure function (zone-cell extraction, trace simplification, etc.).
