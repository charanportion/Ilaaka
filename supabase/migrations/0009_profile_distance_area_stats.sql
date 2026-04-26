-- profile_zone_stats: now reports distance walked (sum of processed activities)
-- and lifetime unique area captured (area of ST_Union of all capture polygons,
-- so walking the same area twice doesn't double-count).
-- security invoker + RLS on activities means non-owners get 0 / 0.
create or replace function public.profile_zone_stats(p_user_id uuid)
returns table (
  distance_walked_m bigint,
  area_captured_m2  bigint
)
language sql
stable
security invoker
as $$
  select
    coalesce((
      select sum(distance_m)::bigint
        from public.activities
       where user_id = p_user_id
         and status  = 'processed'
    ), 0) as distance_walked_m,
    coalesce((
      select st_area(st_union(capture_polygon)::geography)::bigint
        from public.activities
       where user_id = p_user_id
         and status  = 'processed'
         and capture_polygon is not null
    ), 0) as area_captured_m2;
$$;

grant execute on function public.profile_zone_stats(uuid) to authenticated;
