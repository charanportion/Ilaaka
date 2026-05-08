-- Public, anonymized aggregates + recent-activity feed for the marketing
-- landing page. Read by the Next.js landing app via the anon key.
--
-- Why SECURITY DEFINER: activities is RLS-locked to the row's owner, so
-- anon callers can't aggregate it directly. The function exposes only
-- aggregates + a sanitized 5-row feed (color, cell count, timestamp).
-- No PII, no GPS, no usernames, no user_ids.

create or replace function public.landing_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with
    week_window as (
      select now() - interval '7 days' as since
    ),
    weekly as (
      select
        coalesce(sum(a.distance_m), 0)::numeric / 1000.0 as km_total,
        count(distinct a.user_id)                       as walkers
      from public.activities a, week_window w
      where a.status = 'processed'
        and a.started_at >= w.since
    ),
    recent as (
      select
        a.cells_captured as cells,
        a.created_at,
        p.color          as color
      from public.activities a
      join public.profiles p on p.id = a.user_id
      where a.status = 'processed'
        and a.cells_captured > 0
        and a.created_at >= now() - interval '24 hours'
      order by a.created_at desc
      limit 5
    )
  select jsonb_build_object(
    'km_claimed_week', floor(weekly.km_total)::int,
    'walkers_week',    weekly.walkers,
    'recent_claims',   coalesce(
      (select jsonb_agg(
         jsonb_build_object(
           'cells',      r.cells,
           'created_at', r.created_at,
           'color',      r.color
         )
         order by r.created_at desc
       ) from recent r),
      '[]'::jsonb
    )
  )
  from weekly;
$$;

revoke all on function public.landing_stats() from public;
grant execute on function public.landing_stats() to anon, authenticated;

comment on function public.landing_stats() is
  'Anonymized aggregates for the marketing landing page. No PII, no GPS, no usernames. Returns: km_claimed_week (last 7d, processed activities), walkers_week (distinct user_id, last 7d), recent_claims (up to 5 most-recent processed activities in last 24h with color + cell count + timestamp only).';
