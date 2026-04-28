# Onboarding & personalization

The complete spec for Ilaaka's signup → first activity flow. Includes question tiers, screen-by-screen sequence, microcopy, schema additions, analytics events, and downstream personalization rules.

## Locked principles

1. **Three questions max before first activity.** Each onboarding screen drops 5–15% of users. We pay friction tax only for data the product genuinely needs to function.
2. **Progressive profiling.** Most personalization data is captured *in context*, after activation, when the answer carries motivation.
3. **One question per screen.** No multi-field forms in onboarding.
4. **Skippable beyond Tier 1.** A skip is a more honest signal than a forced random answer.
5. **Visual options over text dropdowns.** Big icon tiles, not select menus.
6. **Show progress as a bar, not as "step N of M".** Numbers make users calculate; bars feel like ambient momentum.
7. **Inferred personalization > survey questions when possible.** If we can derive the answer from behavior, do that and confirm with one tap rather than asking.

## Three-tier model

| Tier | When asked | What | Why this tier |
| --- | --- | --- | --- |
| **Tier 1** | Before first activity (mandatory) | Q1 username, Q2 locality, Q3 primary activity | Product cannot function well without these |
| **Tier 2** | Post first activity, on the summary card | Q4 motivation, Q5 frequency, Q6 friend invite | Peak motivation moment; high-value segmentation |
| **Tier 3** | Throughout app, in context | Q7–Q12 (color, club, time, ghost zone, integrations) | Asked only when the answer becomes actionable |

## Schema additions

Add to `public.profiles` via a new migration. **All nullable.** The `profiles` row grows over time.

```sql
-- supabase/migrations/0XX_personalization.sql

create type motivation_kind as enum ('consistency', 'habit', 'compete', 'explore', 'curious');
create type frequency_kind  as enum ('daily', 'multiple_per_week', 'weekends', 'flexible');
create type time_slot_kind  as enum ('morning', 'afternoon', 'evening', 'late_night', 'varies');

alter table public.profiles
  add column usual_locality text,                                    -- Q2 free-form locality name (e.g., "Koramangala 5th Block")
  add column primary_activity activity_type,                         -- Q3 reuse existing enum
  add column motivation motivation_kind,                             -- Q4
  add column target_frequency frequency_kind,                        -- Q5
  add column usual_time_slot time_slot_kind,                         -- Q9 (inferred + confirmed)
  add column onboarding_completed_at timestamptz,                    -- set when Tier 1 finishes
  add column progressive_profile_score integer not null default 0;   -- +1 per Tier 3 question answered

-- Index for segment-based queries (analytics, push targeting)
create index profiles_motivation_idx on public.profiles(motivation) where motivation is not null;
create index profiles_locality_idx   on public.profiles(usual_locality) where usual_locality is not null;
```

`activity_type` already exists from the activities migration (`'run' | 'walk' | 'cycle' | 'hike'`); reuse it.

## The questions

### Tier 1 — Mandatory, before first activity

#### Q1. What should we call you?

| | |
| --- | --- |
| **Field** | Open text input (max 24 chars, alphanumeric + underscore) |
| **Default** | Pre-filled from Google account display name when available |
| **Validation** | Required, unique against `profiles.username` (debounced check, 400ms) |
| **Stored as** | `profiles.username` (already exists) |
| **Microcopy — header** | What should we call you? |
| **Microcopy — subtext** | This is your handle on the map. Pick something your friends will recognize. |
| **CTA** | Continue |

#### Q2. Where do you usually walk or run?

| | |
| --- | --- |
| **Field** | Single-select with 4 tiles + a "Detect my locality" button |
| **Options** | Around my home / Near my office / At a park / Mixed |
| **Detect button** | Uses current GPS + reverse geocoding to suggest a locality name |
| **Stored as** | `profiles.usual_locality` (text, the resolved locality name; not the option key — we want "Koramangala 5th Block", not "around_home") |
| **Microcopy — header** | Where do you usually walk? |
| **Microcopy — subtext** | We'll use this to set up your map. We never share your home address. |
| **CTA** | Continue |

The locality string drives:
- Initial map camera position
- Decoy zone seeding region
- Share card location label
- Future society/locality leaderboards

#### Q3. What's your usual activity?

| | |
| --- | --- |
| **Field** | Single-select with 4 large icon tiles |
| **Options** | Walk / Run / Cycle / Mix it up |
| **Stored as** | `profiles.primary_activity` (`activity_type` enum); "Mix it up" stored as null |
| **Microcopy — header** | What's your usual move? |
| **Microcopy — subtext** | We'll set this as your default — you can change it any time you record. |
| **CTA** | Let's go |

Drives:
- Default activity type on the recorder
- Tonal language: "Track your runs" vs "Track your walks"
- Initial zoom level on the map (cyclists default to wider zoom)

After Q3, set `profiles.onboarding_completed_at = now()` and route to the **first-activity tutorial**, not the home screen. The tutorial is a 90-second guided walk that teaches the capture loop in context.

### Tier 2 — Post-first-activity card

Render below the "You captured N hexes!" celebration. Optional but visible. Each question is a single-tap interaction.

#### Q4. What's pulling you to track this?

| | |
| --- | --- |
| **Field** | Single-select chips (horizontally scrollable) |
| **Options** | Stay consistent / Build a habit / Compete with friends / Explore my city / Just curious |
| **Stored as** | `profiles.motivation` |
| **Microcopy** | One quick thing — what's pulling you to Ilaaka? |
| **Skip** | Visible secondary button |

This is the highest-value segmentation question in the entire app. See "Personalization rules" below for how each value is used.

#### Q5. How often do you want to do this?

| | |
| --- | --- |
| **Field** | Single-select |
| **Options** | Daily / 3–4 times a week / On weekends / Whenever I feel like it |
| **Stored as** | `profiles.target_frequency` |
| **Microcopy** | How often are you thinking? |
| **Skip** | Visible secondary button |

Drives push notification cadence. Hard rule: never send daily prompts to a user with `target_frequency = 'flexible'`.

#### Q6. Got a friend who'd play this with you?

| | |
| --- | --- |
| **Field** | "Invite friends" button → native share sheet with referral link |
| **Stored as** | nothing direct; tracked via `referral_link_clicked` and `referral_install` events |
| **Microcopy** | Ilaaka's better with a rival. Got someone in mind? |
| **Skip** | "Maybe later" |

The referral link is the Branch.io / deferred deep link from `docs/share-and-virality.md` (when written). Format: `https://ilaaka.app/u/<username>`.

### Tier 3 — Progressive, in context

Each one fires when its trigger is met. Maximum one Tier 3 prompt per app session.

#### Q7. Pick your zone color

| | |
| --- | --- |
| **Trigger** | First time the user taps their own hex on the map after capture |
| **Field** | 8-swatch picker, default already assigned |
| **Stored as** | `profiles.color` (already exists) |
| **Microcopy** | Make it yours — pick a color for your territory. |

Increments `progressive_profile_score` on completion.

#### Q8. Are you part of any society or running club?

| | |
| --- | --- |
| **Trigger** | Defer until v1 — when society leaderboards are built. **Do not ship in v0.5.** |
| **Field** | Free text + autocomplete from existing rows once we have density |
| **Stored as** | New table `community_memberships` (don't put on profiles; users can be in multiple) |

Asking too early wastes the question — the data has nowhere to go.

#### Q9. What time do you usually walk or run?

| | |
| --- | --- |
| **Trigger** | After the user has 3+ activities. **Infer first, confirm with one tap.** |
| **Inference** | Group activity start times into time-slot buckets, take the mode |
| **Field** | "Looks like you're a morning person — should we send your daily prompt at 6 AM?" Yes / No / Different time |
| **Stored as** | `profiles.usual_time_slot` |

Inferred + confirmed is far better UX than a survey question. Always do this when behavior data exists.

#### Q10. Want zones around your home to be private?

| | |
| --- | --- |
| **Trigger** | First time the user records an activity within 100m of an inferred home location (we infer home as the most-frequent activity start point after 5+ activities). |
| **Field** | Toggle + radius slider (100m / 250m / 500m). Default 250m. |
| **Stored as** | `profiles.home_geom` (already exists) + new `profiles.ghost_radius_m` (integer, nullable). |
| **Microcopy** | Want to keep your home area private? Zones inside this radius won't show up on the map. |

#### Q11. Sync from Apple Health, Google Fit, or Mi Band?

| | |
| --- | --- |
| **Trigger** | User taps any "import history" or "sync devices" surface (settings screen, profile screen) |
| **Field** | OAuth flow per provider |
| **Stored as** | New table — out of scope for v0.5 |

Defer the implementation. Show the trigger surface but route to a "Coming soon" sheet in v0.5.

#### Q12. Age range / fitness level / weight goal

**Do not ask in v0 or v0.5.** No feature uses this data yet. Asking for unusable data is pure friction tax. Revisit when there's a calorie precision feature, fitness-matched leaderboard, or coaching feature that genuinely consumes the input.

## Questions to **never** ask in onboarding

| Question | Why not |
| --- | --- |
| Email | Already collected via Google OAuth or signup form |
| Phone | OTP fatigue in India is real; defer to v1 if/when needed |
| Profile photo | Optional photo upload screens drop 20%+ of users in B2C apps; offer in profile settings instead |
| "How did you hear about us?" | Use referral codes and Branch.io for attribution; self-report is unreliable and feels like homework |
| Notification preferences | Default to sensible settings; surface controls in settings, not onboarding |
| Gender | Sensitive in this market; only ask if/when a feature genuinely requires it |

## Screen-by-screen flow

Implement as a single Expo Router stack at `app/(onboarding)/`. Each screen is one file. Lift any shared layout (progress bar, back button) into `app/(onboarding)/_layout.tsx`.

```
app/(onboarding)/
├── _layout.tsx                      # Stack with progress bar in header
├── welcome.tsx                      # Splash + "Continue with Google" / "Sign up with email"
├── username.tsx                     # Q1
├── locality.tsx                     # Q2
├── activity.tsx                     # Q3
├── permissions.tsx                  # Location + notification permission requests
└── tutorial.tsx                     # 90-second guided first walk
```

Navigation order:

```
welcome → [auth flow] → username → locality → activity → permissions → tutorial → (app)/map
```

After tutorial completes, set `profiles.onboarding_completed_at` and route to `(app)/map` with the post-activity card showing.

### Permissions screen — non-trivial

Request in this order, each on its own sub-screen with explanatory copy:

1. **Foreground location** — "Ilaaka uses your location only while you're recording an activity." Required to proceed.
2. **Background location** — "To track your full route even if your screen turns off, we need background access." Required to proceed.
3. **Notifications** — "Get alerted when someone captures your zones." Skippable.

Never request all three in a single OS prompt. iOS in particular treats a denied background request as permanent — once denied, the user has to go to system settings to fix it. Each request gets pre-prompt education first.

## The first-activity tutorial

A 90-second guided walk, on-screen prompts overlaying the recorder.

| Phase | Duration | UI |
| --- | --- | --- |
| **Setup** | 0–10s | "Let's claim your first zone. Walk in any direction for about a minute." Big start button. |
| **Walking** | 10–80s | Live trace renders. At ~30s: "You've walked 50 meters. Keep going to claim a zone." At ~60s: "Almost there. Try walking back to where you started to close the loop." |
| **Stop** | 80–90s | "Hit stop when you're ready." Stop button pulses. |
| **Capture moment** | 90s+ | Hexes light up one by one with haptic feedback. Confetti or color burst. "You claimed N hexes. Welcome to Ilaaka." |

This *is* the activation moment. Worth disproportionate engineering and design effort. The North Star activation event is `first_activity_completed` within 10 minutes of signup. Track religiously.

## Personalization rules — what we do with the data

This is the contract that justifies the friction. If we ask, we use it.

### `motivation` drives notification copy

Same trigger event ("you lost 3 hexes"), four different push texts:

| Motivation | Push copy |
| --- | --- |
| `compete` | Priya is ahead of you. Take it back. |
| `consistency` | Don't break the streak — quick walk to defend? |
| `habit` | Your morning slot is open. Reclaim those hexes? |
| `explore` | New territory just opened up nearby. |
| `curious` | Someone walked into your zone. Want to see who? |

Implement as a `notification_templates` lookup keyed on `(trigger_event, motivation)`. Fall back to a generic copy if `motivation` is null.

### `target_frequency` drives push cadence

| Frequency | Daily prompt? | Weekly summary? | Streak language? |
| --- | --- | --- | --- |
| `daily` | Yes, at user's `usual_time_slot` | Yes | Yes — emphasize streaks |
| `multiple_per_week` | No | Yes | Yes — "3-of-4 this week" |
| `weekends` | Saturday and Sunday morning only | Yes | Light streak language only |
| `flexible` | No | Yes, gentle tone | No streak language |

Hard rule encoded in the notification scheduler: never send `daily_prompt` events to users where `target_frequency = 'flexible'`. Set this as a Postgres check constraint or a filter in the scheduler query — your choice — but enforce in code, not in policy.

### `usual_locality` drives map setup and decoy seeding

- Initial map camera centers on the locality centroid (precomputed in a `localities` lookup table; for v0.5 hardcode 5–10 Bengaluru localities)
- Decoy zones for the first 7 days are seeded around this centroid, not generic city center
- Share card location label uses this string

### `primary_activity` drives defaults and tonal copy

- Recorder defaults to this activity type
- Map default zoom: walk = 16, run = 15, cycle = 13
- Onboarding tutorial copy adapts: "your first run" vs "your first walk"
- Push notifications use the right verb

### `usual_time_slot` drives push timing

- Daily prompts fire at the start of the slot (morning = 6 AM, evening = 6 PM, etc.)
- Streak warnings fire at the end of the slot ("3 hours left to keep your streak alive")

## Analytics events to fire

Add to PostHog. These power the activation funnel and segmentation reports.

```typescript
// During Tier 1
analytics.capture('onboarding_started');
analytics.capture('onboarding_question_answered', { tier: 1, question: 'username' });
analytics.capture('onboarding_question_answered', { tier: 1, question: 'locality', value: <locality> });
analytics.capture('onboarding_question_answered', { tier: 1, question: 'primary_activity', value: <activity> });
analytics.capture('onboarding_completed', { tier_1_complete: true });

// Permissions
analytics.capture('permission_requested', { kind: 'location_foreground' });
analytics.capture('permission_granted',   { kind: 'location_foreground' });
analytics.capture('permission_denied',    { kind: 'location_foreground' });   // and same for background, notifications

// Tutorial / first activity
analytics.capture('tutorial_started');
analytics.capture('tutorial_step_completed', { step: 'walking' });
analytics.capture('first_activity_completed', { duration_s, distance_m, cells_captured });

// Tier 2
analytics.capture('onboarding_question_answered', { tier: 2, question: 'motivation', value: <motivation> });
analytics.capture('onboarding_question_skipped',  { tier: 2, question: 'motivation' });
// ... same pattern for frequency, friend_invite

// Tier 3
analytics.capture('progressive_profile_answered', { question: <q_id>, value: <value> });
```

The activation funnel to monitor in PostHog:

```
signup → location_foreground_granted → location_background_granted →
tutorial_started → first_activity_completed → first_zone_captured
```

The largest drop-off step is your highest-leverage fix.

## Implementation order — v0.5 sprint

Build in this order. Each phase ends in something demoable.

**Day 1 — schema + analytics plumbing.**
- Migration with new enums and columns
- PostHog event helpers in `lib/analytics.ts`
- Empty `app/(onboarding)/` route group

**Day 2–3 — Tier 1 screens.**
- `welcome.tsx`, `username.tsx`, `locality.tsx`, `activity.tsx`
- Reverse geocoding helper for the "Detect my locality" button (use `expo-location` `reverseGeocodeAsync`)
- Validation, debouncing, the auth gate redirect when `onboarding_completed_at` is null

**Day 4 — permissions screens.**
- Three sub-screens with pre-prompt education
- Graceful handling of denials

**Day 5–6 — tutorial.**
- Overlay system on the recorder
- Time-based prompt advancement
- Confetti / haptic feedback at capture moment

**Day 7 — Tier 2 on the post-activity card.**
- Motivation chips, frequency picker, invite button
- Skip handling
- Save to profile

**Day 8 — personalization wiring.**
- Notification template lookup keyed on motivation
- Map default zoom from primary_activity
- Recorder default activity type from primary_activity

**Day 9–10 — polish + Tier 3 triggers.**
- Color picker on first hex tap
- Inferred `usual_time_slot` confirmation after 3 activities
- Ghost zone toggle when applicable

## Definition of done for the onboarding sprint

A new user opening the app can:

1. Sign in with Google in under 30s.
2. Complete Tier 1 in under 60s.
3. Grant all three permissions with no confusion.
4. Complete a 90-second tutorial walk.
5. See their first hexes captured.
6. See and dismiss/answer the Tier 2 questions on the post-activity card.
7. Land on the map with their locality centered, zones rendered, and at least one decoy zone visible.

Total time from app open to first captured zone: under 5 minutes. PostHog confirms `first_activity_completed` rate above 60% for new signups within their first session.

## Cultural and language notes

- **"Locality"** is the standard Indian English word — use it instead of "neighborhood".
- **"Society"** is a first-class concept (gated residential complexes); reserve it for the v1 society leaderboard, don't dilute the word now.
- **Mark all strings with i18n keys from day one** even though only English ships in v0.5. Hindi and Kannada are then config changes, not code rewrites.
- **Avoid Western fitness-app idioms** that don't translate ("crush your goals", "beast mode"). Tone should be warm-competitive, not aggressive.