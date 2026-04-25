# Architecture

## Goals

1. **Ship the v0 core loop on free tiers.** Annual cost target: under ₹2,000 (domain + maybe SMS later) up to ~5k MAU.
2. **Don't paint into a corner.** Every component has a clean migration path. No proprietary APIs that block a future move to AWS / GCP.
3. **Operate with one developer.** Minimize the number of services, dashboards, and credentials.

## Stack at a glance

| Layer | Choice | Why |
| --- | --- | --- |
| Mobile | Expo (React Native) | Single codebase, OTA updates, EAS handles iOS/Android signing for free. TypeScript-native. |
| Maps | MapLibre GL Native + OSM tiles | Open-source, no usage cap. Mapbox style spec compatible — we can swap to Mapbox/Protomaps later without rewriting layers. |
| Backend | Supabase | Postgres + PostGIS + h3 + Auth + Realtime + Storage + Edge Functions in one project. Replaces what would otherwise be 5 AWS services. |
| Auth | Supabase Auth (Google OAuth + email/password) | Free, built into the Supabase project, supports the providers we need. No phone OTP in v0 — Google login is enough for our urban target. |
| DB client | `@supabase/supabase-js` directly. No ORM. | Drizzle/Prisma both have weak PostGIS support. Spatial queries are RPCs (Postgres functions); everything else is the supabase-js fluent builder. |
| Async jobs | V0: synchronous Edge Functions. V1+: Inngest. | Most activities process in <2s. Sync is simpler. Inngest gets added when we need retries / durable execution. |
| Push | Expo Push | Free wrapper around APNs and FCM. Don't reinvent. |
| Storage | Supabase Storage | 1 GB free; covers avatars and share cards through ~5k users. R2 if we outgrow it. |
| Analytics | PostHog (free tier) | 1M events/month free; replaces both Mixpanel and Amplitude from the PRD. |
| Errors | Sentry (free tier) | 5k errors/month. Mobile + Edge Function instrumentation from day one. |

## Request flow — the core loop

```
USER SIGN-IN
  Mobile (Expo) ──signInWithOAuth (google)─→ Supabase Auth
                ←──── JWT (1h) + refresh token ───
  Mobile stores the session in SecureStore via supabase-js.

ACTIVITY RECORDING (in-app, mostly client-side)
  expo-location streams positions → buffered to expo-sqlite
  MapLibre overlays the live trace on screen
  No network traffic during the activity.

ACTIVITY SUBMISSION (the hot path)
  Mobile ──POST /functions/v1/submit-activity─→ Edge Function (Deno)
       Body: { type, started_at, ended_at, trace: GeoJSON LineString, samples }
       Auth: Bearer <user JWT>

  Edge Function (with service role):
    1. Validates input (Zod). Checks min duration / distance / GPS accuracy.
    2. Inserts a row into `activities` with status='processing'.
    3. Simplifies trace via PostGIS ST_SimplifyPreserveTopology.
    4. Builds a polygon (closed loop) or buffered corridor (open route).
    5. h3_polygon_to_cells(polygon, 11) → list of H3 cell IDs.
    6. Upserts ownership in `zone_ownership`. Writes a row per displaced
       owner into `zone_ownership_history`.
    7. Collects displaced-owner user IDs and queues Expo Push pings.
    8. Updates the activity status to 'processed'.
  ←── 200 { activity_id, captured_cell_count, zones_lost: [...] }

  SLA: <5s for traces under ~1 hour. Wall-clock budget on Supabase free
  tier is 60s, so there's plenty of headroom.

PUSH TO DISPLACED OWNERS
  Edge Function ──Expo Push API─→ APNs / FCM ──→ rival's device
  Notification: "[Username] captured your zone in [Area]!"

MAP RENDERING (returning to the map screen)
  Mobile ──supabase.rpc('zones_in_bbox', {bbox})─→ Postgres
        ←── [{h3_index, owner_id, owner_color, captured_at}, ...]
  MapLibre paints the cells via a custom fill layer. Zones the user owns
  render in their personal color; everyone else's zones render in the
  owner's color at lower opacity.
```

## Service boundaries

**The mobile app is responsible for:**
- Capturing GPS (foreground + background).
- Buffering the trace offline.
- Rendering the map and the trace.
- Handling auth (Supabase Auth SDK).
- Submitting completed activities.
- Reading and rendering zones via RPC.

**Edge Functions are responsible for:**
- Validating input from the client.
- All spatial computation (simplification, polygonization, H3 cell extraction).
- Writing to `activities`, `zones`, `zone_ownership`, `zone_ownership_history`.
- Triggering push notifications.

**Postgres (with PostGIS + h3) owns:**
- All persistent state.
- RLS — the source of truth for "who can see what."
- RPC functions for spatial reads (`zones_in_bbox`, `friends_feed`).
- Materialized views for leaderboards (added in v1).

**The mobile app never:**
- Does spatial math beyond local rendering.
- Computes zone ownership.
- Has the service-role key.

## Why Supabase (not Neon + DIY)

We considered Neon + Hono on Cloudflare Workers + Clerk. Neon's auto-resume model is technically nicer than Supabase's pause behavior, but Supabase consolidates five services into one. With even a handful of weekly-active beta users hitting the DB, the pause never triggers. During pre-launch quiet periods, a daily ping (cron-job.org or GitHub Actions) keeps it warm — total setup time ~2 minutes.

The trade we accept: if Supabase the company has issues, we have one big dependency instead of five small ones. Mitigation: Postgres is portable. The schema, RPCs, and migrations all run on any Postgres + PostGIS + h3 host. Edge Functions are vanilla Deno — they port to Cloudflare Workers or Lambda with minor changes. Auth migration to Clerk or Auth0 is the only piece that would require user re-authentication.

## When to migrate (and to what)

Migration triggers and targets, in roughly the order they hit:

| Trigger | Action | Cost change |
| --- | --- | --- |
| Daily Edge Function invocations >500k | Upgrade to Supabase Pro ($25/mo) | +$25/mo |
| DB approaches 400 MB | Same upgrade — Pro gives 8 GB | included |
| Storage approaches 800 MB | Move share cards + avatars to Cloudflare R2 (10 GB free) | $0 |
| Real-time map needs <1s update | Add WebSocket via Supabase Realtime channels (already there, just turn it on) | $0 |
| Leaderboards take >2s to load | Add Upstash Redis (free 10k commands/day, then $0.20/100k) | ~$5/mo |
| Push volume >10k/day | Stay on Expo Push (no cap), but verify FCM/APNs project quotas | $0 |
| 100k+ MAU | Consider migrating Postgres to Crunchy Bridge / RDS for read replicas | $40-100/mo |

The architecture is designed so that **none of these migrations require client changes** beyond environment variables. The mobile app talks to one URL for the API, one for tiles, one for push. Each can be swapped independently.

## Out of scope for v0 (but architected-for)

These features are planned in the PRD and the architecture supports them, but they are not built in v0:

- **Real-time map updates** (WebSocket): Supabase Realtime is enabled but unused. Map polls on focus + every 30s while open.
- **Leaderboards beyond friends:** schema supports city / pin code / society, but only friends-list is queried in v0.
- **Brand challenges / events:** schema has `challenges` table stub but no UI.
- **Wearable integrations:** Apple Health / Google Fit / Mi Band deferred to v1.
- **Pro tier / payments:** entirely deferred. UI gates exist on the architecture diagrams but no Razorpay integration.
- **Ghost zones (home privacy):** v0 ships with a hard-coded 500m radius around any address the user marks. v1 makes it configurable + multi-zone.
- **Hindi UI:** strings extracted via i18n-js from day one, but only English is shipped in v0. Hindi is a translation pass, not new code.
