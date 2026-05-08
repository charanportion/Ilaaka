-- friends_feed should only show activities of people you follow, not your own.
-- Showing your own activities in the feed makes it non-empty even with zero follows,
-- which is confusing. Your own activities belong on the profile screen.

create or replace function public.friends_feed(p_limit int default 20)
returns table (
  activity_id    uuid,
  user_id        uuid,
  username       text,
  display_name   text,
  avatar_url     text,
  color          text,
  type           public.activity_type,
  started_at     timestamptz,
  duration_s     int,
  distance_m     numeric,
  cells_captured int,
  cells_lost     int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id           as activity_id,
    a.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.color,
    a.type,
    a.started_at,
    a.duration_s,
    a.distance_m,
    coalesce(a.cells_captured, 0) as cells_captured,
    coalesce(a.cells_lost,     0) as cells_lost
  from public.activities a
  join public.profiles p on p.id = a.user_id
  where a.status = 'processed'
    and a.user_id in (
      select followee_id from public.follows where follower_id = auth.uid()
    )
  order by a.started_at desc
  limit least(p_limit, 50);
$$;

grant execute on function public.friends_feed(int) to authenticated;
