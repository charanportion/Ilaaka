-- 0029_security_hardening.sql
-- Production hardening: rate limiting, idempotency, value-range CHECKs, defence-in-depth policies.

-- ── Rate limiting ──────────────────────────────────────────────────────────────
-- Tracks per-user submit cadence so a compromised JWT can't flood the function.
-- Window resets every hour. 30 submissions/hr is far above any legit user.

create table if not exists public.submit_rate_limit (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  window_start              timestamptz not null default now(),
  count_in_window           integer not null default 0,
  last_submit_at            timestamptz not null default now()
);

alter table public.submit_rate_limit enable row level security;
-- No client policies — service role only. Even SELECT is denied to authenticated users.

create or replace function public.check_and_bump_submit_rate(
  p_user_id uuid,
  p_max_per_hour integer default 30
)
returns table(allowed boolean, count_in_window integer, retry_after_s integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
  v_now timestamptz := now();
begin
  -- Upsert + atomically advance the window if it's >1h old.
  insert into public.submit_rate_limit (user_id, window_start, count_in_window, last_submit_at)
    values (p_user_id, v_now, 1, v_now)
    on conflict (user_id) do update
      set window_start = case
            when public.submit_rate_limit.window_start < v_now - interval '1 hour'
            then v_now
            else public.submit_rate_limit.window_start
          end,
          count_in_window = case
            when public.submit_rate_limit.window_start < v_now - interval '1 hour'
            then 1
            else public.submit_rate_limit.count_in_window + 1
          end,
          last_submit_at = v_now
    returning window_start, count_in_window into v_window_start, v_count;

  return query select
    (v_count <= p_max_per_hour) as allowed,
    v_count as count_in_window,
    greatest(0, extract(epoch from (v_window_start + interval '1 hour' - v_now))::integer) as retry_after_s;
end;
$$;

revoke all on function public.check_and_bump_submit_rate(uuid, integer) from public;
grant execute on function public.check_and_bump_submit_rate(uuid, integer) to service_role;

-- ── Idempotency on activity submits ────────────────────────────────────────────
-- Mobile client generates a UUID per pending activity in SQLite. Replays of the
-- same key (network retry) return the existing activity_id instead of inserting
-- a duplicate (which would re-claim cells and re-fan-out push notifications).

alter table public.activities
  add column if not exists idempotency_key uuid;

create unique index if not exists activities_user_idempotency_uidx
  on public.activities(user_id, idempotency_key)
  where idempotency_key is not null;

-- ── Value-range CHECKs ─────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'activities_calories_range_chk'
  ) then
    alter table public.activities
      add constraint activities_calories_range_chk
      check (calories is null or (calories >= 0 and calories <= 20000));
  end if;
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'activities_duration_distance_chk'
  ) then
    alter table public.activities
      add constraint activities_duration_distance_chk
      check (duration_s >= 0 and duration_s <= 86400 and distance_m >= 0 and distance_m <= 500000);
  end if;
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'activities_timeline_chk'
  ) then
    alter table public.activities
      add constraint activities_timeline_chk
      check (ended_at > started_at);
  end if;
end$$;

-- Push token format — Expo tokens always start with ExponentPushToken[ or ExpoPushToken[.
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'push_tokens_format_chk'
  ) then
    alter table public.push_tokens
      add constraint push_tokens_format_chk
      check (token like 'ExponentPushToken[%' or token like 'ExpoPushToken[%');
  end if;
end$$;

-- ── Activity insert-deny policy (defense in depth) ────────────────────────────
-- Edge Function uses service_role which bypasses RLS, so this only affects
-- direct inserts from authenticated/anon clients. Makes the intent explicit
-- and prevents future foot-guns.

drop policy if exists "activities_insert_denied" on public.activities;
create policy "activities_insert_denied" on public.activities
  for insert
  to authenticated, anon
  with check (false);

drop policy if exists "activities_update_denied" on public.activities;
create policy "activities_update_denied" on public.activities
  for update
  to authenticated, anon
  using (false)
  with check (false);

drop policy if exists "activities_delete_denied" on public.activities;
create policy "activities_delete_denied" on public.activities
  for delete
  to authenticated, anon
  using (false);

-- ── Tighten activity-photos storage policy ────────────────────────────────────
-- Existing policy validates only the first folder is the caller's user_id.
-- Add a second check that the activity_id segment (folder[2]) is null (draft
-- uploads) or belongs to the caller. This is defense-in-depth: the Edge
-- Function is the only legitimate writer of finalized paths, but a malicious
-- client could otherwise upload directly to <self>/<other-user-activity-id>/.

drop policy if exists "activity_photos_insert_own" on storage.objects;
create policy "activity_photos_insert_own" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'activity-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
    and (
      -- Allow draft uploads under <user>/draft/<localId>/...
      (storage.foldername(name))[2] = 'draft'
      -- Or final paths only if the activity is owned by the caller
      or exists (
        select 1 from public.activities a
        where a.user_id = auth.uid()
          and a.id::text = (storage.foldername(name))[2]
      )
    )
  );

-- ── Comment ──
comment on table public.submit_rate_limit is
  'Per-user submit-activity rate limit. Service-role-only; check_and_bump_submit_rate() is the entry point.';
comment on column public.activities.idempotency_key is
  'Client-generated UUID per pending activity in mobile SQLite buffer. Allows safe submit retries.';
