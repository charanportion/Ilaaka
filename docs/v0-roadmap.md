# v0 roadmap

The path from empty repo to closed beta in Bengaluru. Each phase ends with something demoable. Build in order; do not skip ahead. The whole thing is achievable solo in 4–6 weeks of focused effort.

## Scope of v0

**In:** the core capture loop for one person and their friends. Phase 0 through Phase 5 below.

**Out (deferred to v0.5+):**
- Public city / pin code / society leaderboards (only friends-of-friends in v0).
- Activity feed beyond friends.
- Clubs, challenges, brand partnerships.
- Hindi UI (English only in v0; strings extracted via i18n-js to make translation a one-pass change).
- Pro tier and any payment surface.
- Wearable integrations (Apple Health, Google Fit, Mi Band).
- Share-to-Instagram / WhatsApp story cards.
- Ghost zones (configurable home-privacy radius).
- Real-time WebSocket map updates (polling on focus + 30s interval is good enough).
- Steal-notification throttling (cap of 5/hour per PRD §4.1.3 — add when it bites).

## Phase 0 — project setup (Day 1–2)

Get the skeleton running end-to-end with no real features.

**Deliverables:**
- Repo initialized with the folder structure from `CLAUDE.md`.
- Supabase project created (free tier).
- GCP OAuth client IDs created (web, iOS, Android).
- Expo app boots on iOS simulator and a physical Android device.
- `pnpm install` and `supabase db push` both run cleanly.
- Sentry + PostHog SDKs initialized; both report a test event.

**Acceptance:** the app shows a placeholder home screen on a physical device. CI (GitHub Actions) runs `tsc --noEmit` on every push.

## Phase 1 — auth (Day 3–5)

Build the unauthenticated → authenticated flow with both email/password and Google OAuth.

**Deliverables:**
- `(auth)/sign-up.tsx`, `(auth)/sign-in.tsx`, `auth-callback.tsx`.
- Email/password signup creates a row in `auth.users`, which auto-creates a `profiles` row via trigger.
- Google OAuth via `signInWithOAuth` (Flow A from `docs/auth.md`) — works in Expo Go.
- Auth gate in `app/_layout.tsx` redirects unauthenticated users to `(auth)/sign-in`.
- Sign-out works.
- Session persists across app restarts via `expo-secure-store`.
- The first migration is in `supabase/migrations/`: extensions, `profiles` table, RLS, trigger.

**Acceptance:** sign up via email; sign out; sign in with the same email; sign out; sign in with Google; observe the same `profiles` row each time on the Supabase dashboard.

## Phase 2 — activity recording (Day 6–10)

Build the recorder UI and the offline GPS buffer. No zone capture yet — just record and save.

**Deliverables:**
- `app/(app)/record.tsx` with start / pause / stop / activity-type picker.
- `expo-location` foreground tracking with 1Hz / 5m sampling.
- `expo-location` background tracking working when the app is minimized (requires dev build).
- `expo-sqlite` buffer holds points across app restarts.
- Live map shows the in-progress trace as a polyline.
- On stop: derive distance, duration, calories estimate; show a summary card; save to local DB pending submission.
- Migration adds the `activities` table (without the `capture_polygon` column being used yet) and RLS.

**Acceptance:** record a 1km walk on a real Android device, kill the app mid-recording, reopen, finish the walk, see the full trace on the summary screen.

## Phase 3 — zone capture pipeline (Day 11–15)

The technically hardest phase. Implement the Edge Function and the SQL function from `docs/zone-capture-pipeline.md`.

**Deliverables:**
- Migration adds `zone_ownership`, `zone_ownership_history`, indexes, RLS.
- Migration adds the `capture_activity(uuid)` PL/pgSQL function.
- `supabase/functions/submit-activity/index.ts` deployed.
- Mobile submits the completed activity to `submit-activity` over HTTPS with the user JWT.
- Response includes `cells_captured` and `cells_lost`.
- Post-activity card shows "You captured X hexes!" and "You lost Y hexes from Z" if applicable.

**Acceptance:** on a real device, walk a closed loop around a block, hit stop, see the count of cells captured. Re-walk the same block from a second account, observe ownership changes in the database. Activities under 60s or under 250m are rejected with a clear message.

## Phase 4 — map rendering (Day 16–18)

Show captured zones on the map for the user and everyone.

**Deliverables:**
- Migration adds the `zones_in_bbox(...)` RPC.
- `components/map/ZoneMap.tsx` queries the RPC on map move (debounced).
- Owned cells render as colored hex fills; the user's own zones get the `profiles.color` value, others get their owner's color at lower opacity.
- Map tab is the default tab.
- "My zones" toggle filters to just the user's owned cells.
- Profile screen shows total cells currently owned and total captured all-time.

**Acceptance:** open the map, see zones rendered. Pan around — new zones load. Tap a zone — it shows the owner's username and capture date. Capture a new zone via Phase 3, return to map, see the zone now owned by you.

## Phase 5 — push notifications and friends (Day 19–24)

Steal notifications + the social graph, then it's a closed beta.

**Deliverables:**
- Migration adds `push_tokens` and `follows`.
- `lib/push.ts` registers the Expo Push token on every login.
- `submit-activity` Edge Function fans out push to displaced owners.
- `app/(app)/friends.tsx`: search users by username; follow / unfollow.
- The map's "Friends only" toggle filters zones to only those owned by users the current user follows.
- A friends-only feed (very minimal — last 20 activities by people you follow).

**Acceptance:** two physical devices, two accounts that follow each other. Account A captures a zone, Account B receives a push notification. Account B taps it, lands on the map showing the lost zone. Account B then re-walks the area and recaptures.

## Phase 6 — beta polish (Day 25–30)

Things that aren't features but matter for shipping to 5–10 friends.

**Deliverables:**
- App icon + splash screen.
- About / privacy policy / terms screens (lawyers can wait; copy something reasonable).
- `pg_cron` runs `cleanup_expired_zones()` hourly.
- Weekly stats summary as a Sunday-evening push (PRD §4.6).
- Sentry + PostHog dashboards set up with the events that matter (signup, first activity, zone captured, zone lost, push received).
- One round of dogfooding: walk Koramangala for a week, fix every paper-cut.
- TestFlight (iOS) and Internal Testing track (Android Play Console) builds shipped to friends.

**Acceptance:** five friends have the app, have recorded at least three activities each over a week, and at least one zone-steal-and-reclaim has happened between two of them. PostHog shows D1 retention >50%.

## Daily build cadence — recommended

- **Mornings:** the hard technical work (zone capture, map rendering, GPS). Cold focus.
- **Afternoons:** the surrounding work (UI polish, error handling, instrumentation).
- **Evenings:** dogfood. Walk to a coffee shop. Whatever you ship the next morning, *use* it.

## What "done" looks like for v0

You can hand the app to a friend who lives in Bengaluru. Within five minutes they can:
1. Sign in with Google.
2. Walk around their society block.
3. Hit stop and see their colored hexes on the map.
4. Receive a push when you (or another friend) captures one of their hexes.
5. Walk the same block to take it back.

Anything beyond this is post-v0. Anything missing from this list is a v0 blocker.
