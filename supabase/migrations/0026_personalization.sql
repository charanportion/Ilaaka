-- 0026_personalization.sql
-- Adds Tier 1/2/3 onboarding fields to public.profiles. All nullable so the
-- row grows over time as the user completes onboarding and progressive prompts.
-- See docs/onboarding.md.

create type motivation_kind as enum ('consistency', 'habit', 'compete', 'explore', 'curious');
create type frequency_kind  as enum ('daily', 'multiple_per_week', 'weekends', 'flexible');
create type time_slot_kind  as enum ('morning', 'afternoon', 'evening', 'late_night', 'varies');

alter table public.profiles
  add column usual_locality            text,
  add column primary_activity          activity_type,
  add column motivation                motivation_kind,
  add column target_frequency          frequency_kind,
  add column usual_time_slot           time_slot_kind,
  add column ghost_radius_m            integer,
  add column onboarding_completed_at   timestamptz,
  add column progressive_profile_score integer not null default 0;

create index profiles_motivation_idx on public.profiles(motivation) where motivation is not null;
create index profiles_locality_idx   on public.profiles(usual_locality) where usual_locality is not null;
