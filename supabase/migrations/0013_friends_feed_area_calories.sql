-- Add area_captured_m2 (from capture_polygon) and calories to friends_feed.

drop function if exists public.friends_feed(int);

create or replace function public.friends_feed(p_limit int default 20)
returns table (
  activity_id      uuid,
  user_id          uuid,
  username         text,
  display_name     text,
  avatar_url       text,
  color            text,
  type             public.activity_type,
  started_at       timestamptz,
  duration_s       int,
  distance_m       numeric,
  area_captured_m2 bigint,
  calories         int
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
    coalesce(
      st_area(a.capture_polygon::geography)::bigint, 0
    )              as area_captured_m2,
    a.calories
  from public.activities a
  join public.profiles p on p.id = a.user_id
  where a.status = 'processed'
    and (
      a.user_id = auth.uid()
      or a.user_id in (
        select followee_id from public.follows where follower_id = auth.uid()
      )
    )
  order by a.started_at desc
  limit least(p_limit, 50);
$$;

grant execute on function public.friends_feed(int) to authenticated;
