-- Phase 6: weekly stats summary push.
-- Aggregate per-user stats for the last 7 days, plus a pg_cron schedule
-- that pings the weekly-stats Edge Function every Sunday 13:30 UTC (= 19:00 IST).

-- ── Aggregate stats RPC ───────────────────────────────────────────────────────
-- security definer because activities RLS is read_own; the Edge Function calls
-- this with service role auth and per-user ID. Returns aggregate numbers only,
-- never raw GPS (privacy rule).

create or replace function public.weekly_stats_for_user(p_user_id uuid)
returns table (
  distance_m       bigint,
  area_m2          bigint,
  activity_count   int,
  cells_won        int,
  cells_lost       int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(a.distance_m)::bigint, 0)                          as distance_m,
    coalesce(
      st_area(st_union(st_makevalid(a.capture_polygon))::geography)::bigint,
      0
    )                                                                as area_m2,
    count(*)::int                                                    as activity_count,
    coalesce(sum(a.cells_captured)::int, 0)                          as cells_won,
    coalesce(sum(a.cells_lost)::int, 0)                              as cells_lost
  from public.activities a
  where a.user_id     = p_user_id
    and a.status      = 'processed'
    and a.started_at  > now() - interval '7 days';
$$;

grant execute on function public.weekly_stats_for_user(uuid) to service_role;

-- ── Cron schedule ─────────────────────────────────────────────────────────────
-- Requires:
--   alter database postgres set app.settings.weekly_stats_url = 'https://<ref>.supabase.co/functions/v1/weekly-stats';
--   alter database postgres set app.settings.service_role_key = '<service_role_jwt>';
-- (Run once in Supabase Dashboard SQL editor; values not committed to repo.)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Drop any prior schedule with the same name so this migration is re-runnable.
do $$
begin
  perform cron.unschedule('weekly-stats-push');
exception when others then
  -- ignore "job not found"
  null;
end $$;

select cron.schedule(
  'weekly-stats-push',
  '30 13 * * 0',
  $cron$
    select net.http_post(
      url     := current_setting('app.settings.weekly_stats_url', true),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type',  'application/json'
      ),
      body    := '{}'::jsonb
    );
  $cron$
);
