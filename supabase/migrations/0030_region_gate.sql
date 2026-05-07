-- Region gate: restrict v0 to Hyderabad.
--
-- Each profile carries a region_status set during onboarding (after the
-- foreground-location permission grant). Blocked users land on a polite
-- "we'll let you know when Ilaaka comes to your city" screen and can
-- submit a request to be notified when we expand to their area.

alter table public.profiles
  add column if not exists region_status text
  check (region_status in ('allowed','blocked'));

create table if not exists public.region_requests (
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  city         text not null,
  detected_lat double precision,
  detected_lng double precision,
  source       text,                                       -- 'blocked_signup' | 'blocked_recheck'
  created_at   timestamptz not null default now()
);

-- A user can submit one request per city (case-insensitive).
create unique index if not exists region_requests_user_city_idx
  on public.region_requests (user_id, lower(city));

alter table public.region_requests enable row level security;

drop policy if exists "region_requests_insert_self"
  on public.region_requests;
create policy "region_requests_insert_self"
  on public.region_requests
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "region_requests_select_self"
  on public.region_requests;
create policy "region_requests_select_self"
  on public.region_requests
  for select to authenticated
  using (auth.uid() = user_id);
