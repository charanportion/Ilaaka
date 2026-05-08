-- Phase 9: progress page (weekly metrics, 12-week history, streaks, goals).
-- All week boundaries computed in Asia/Kolkata since Ilaaka is India-only.

-- ── Schema ────────────────────────────────────────────────────────────────────

alter table public.activities
  add column if not exists elevation_gain_m numeric(8, 2) not null default 0;

create table if not exists public.user_goals (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  weekly_distance_m bigint not null default 10000,    -- 10 km
  weekly_area_m2    bigint not null default 50000,    -- 5 ha
  updated_at        timestamptz not null default now()
);

alter table public.user_goals enable row level security;

drop policy if exists "user_goals_select_own" on public.user_goals;
create policy "user_goals_select_own" on public.user_goals
  for select using (auth.uid() = user_id);

drop policy if exists "user_goals_insert_own" on public.user_goals;
create policy "user_goals_insert_own" on public.user_goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_goals_update_own" on public.user_goals;
create policy "user_goals_update_own" on public.user_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Current week metrics ──────────────────────────────────────────────────────
-- Returns aggregate distance/duration/elevation for the current ISO week (IST).

create or replace function public.current_week_metrics(p_user_id uuid)
returns table (
  distance_m       bigint,
  duration_s       bigint,
  elevation_gain_m bigint,
  activity_count   int
)
language sql
stable
security invoker
as $$
  with bounds as (
    select date_trunc('week', (now() at time zone 'Asia/Kolkata'))::date as week_start_ist
  )
  select
    coalesce(sum(a.distance_m)::bigint, 0)        as distance_m,
    coalesce(sum(a.duration_s)::bigint, 0)        as duration_s,
    coalesce(sum(a.elevation_gain_m)::bigint, 0)  as elevation_gain_m,
    count(*)::int                                  as activity_count
  from public.activities a, bounds b
  where a.user_id    = p_user_id
    and a.status     = 'processed'
    and (a.started_at at time zone 'Asia/Kolkata')::date >= b.week_start_ist;
$$;

grant execute on function public.current_week_metrics(uuid) to authenticated;

-- ── Weekly history (last N weeks, Monday IST starts) ──────────────────────────

create or replace function public.weekly_history(p_user_id uuid, p_weeks int default 12)
returns table (
  week_start     date,
  distance_m     bigint,
  area_m2        bigint,
  activity_count int
)
language sql
stable
security invoker
as $$
  with weeks as (
    select generate_series(
      date_trunc('week', (now() at time zone 'Asia/Kolkata'))::date - (p_weeks - 1) * interval '7 days',
      date_trunc('week', (now() at time zone 'Asia/Kolkata'))::date,
      interval '7 days'
    )::date as week_start
  ),
  acts as (
    select
      date_trunc('week', a.started_at at time zone 'Asia/Kolkata')::date as wk,
      a.distance_m,
      a.capture_polygon
    from public.activities a
    where a.user_id = p_user_id
      and a.status  = 'processed'
      and (a.started_at at time zone 'Asia/Kolkata')::date
            >= date_trunc('week', (now() at time zone 'Asia/Kolkata'))::date - (p_weeks - 1) * interval '7 days'
  )
  select
    w.week_start,
    coalesce(sum(acts.distance_m)::bigint, 0) as distance_m,
    coalesce(
      st_area(st_union(st_makevalid(acts.capture_polygon))::geography)::bigint,
      0
    ) as area_m2,
    count(acts.distance_m)::int as activity_count
  from weeks w
  left join acts on acts.wk = w.week_start
  group by w.week_start
  order by w.week_start;
$$;

grant execute on function public.weekly_history(uuid, int) to authenticated;

-- ── Streak stats (any-day-with-activity, IST days) ────────────────────────────
-- current_streak: consecutive days ending at today or yesterday IST.
-- max_streak:    longest run of consecutive activity days ever.

create or replace function public.streak_stats(p_user_id uuid)
returns table (
  current_streak     int,
  max_streak         int,
  last_activity_date date
)
language plpgsql
stable
security invoker
as $$
declare
  today_ist date := (now() at time zone 'Asia/Kolkata')::date;
begin
  return query
  with days as (
    select distinct (a.started_at at time zone 'Asia/Kolkata')::date as d
    from public.activities a
    where a.user_id = p_user_id
      and a.status  = 'processed'
  ),
  grouped as (
    select d, d - (row_number() over (order by d))::int * interval '1 day' as grp
    from days
  ),
  runs as (
    select min(d) as run_start, max(d) as run_end, count(*)::int as len
    from grouped
    group by grp
  )
  select
    coalesce((
      select len from runs
      where run_end >= today_ist - interval '1 day'
      order by run_end desc
      limit 1
    ), 0)::int as current_streak,
    coalesce((select max(len) from runs), 0)::int as max_streak,
    (select max(d) from days) as last_activity_date;
end;
$$;

grant execute on function public.streak_stats(uuid) to authenticated;

-- ── Activity days for a month (calendar) ──────────────────────────────────────

create or replace function public.activity_days(p_user_id uuid, p_month_start date)
returns table (
  day            date,
  activity_count int,
  distance_m     bigint
)
language sql
stable
security invoker
as $$
  select
    (a.started_at at time zone 'Asia/Kolkata')::date as day,
    count(*)::int                                     as activity_count,
    coalesce(sum(a.distance_m)::bigint, 0)            as distance_m
  from public.activities a
  where a.user_id = p_user_id
    and a.status  = 'processed'
    and (a.started_at at time zone 'Asia/Kolkata')::date >= p_month_start
    and (a.started_at at time zone 'Asia/Kolkata')::date <  (p_month_start + interval '1 month')::date
  group by 1
  order by 1;
$$;

grant execute on function public.activity_days(uuid, date) to authenticated;
