-- profile_zone_stats: area_captured_m2 should reflect CURRENT territory,
-- not lifetime captures. Subtract any later overlapping polygons captured by
-- other users (matches the visual map and zone_ownership semantics).
-- distance_walked_m stays as lifetime — that's a historical fact.

create or replace function public.profile_zone_stats(p_user_id uuid)
returns table (
  distance_walked_m bigint,
  area_captured_m2  bigint
)
language sql
stable
security invoker
as $$
  with my_polys as (
    select a.id, a.created_at,
           st_makevalid(a.capture_polygon) as g
    from public.activities a
    where a.user_id        = p_user_id
      and a.status          = 'processed'
      and a.capture_polygon is not null
      and a.created_at      > now() - interval '14 days'
  ),
  visible_polys as (
    select
      case
        when sub.subtractor is null then p.g
        else st_difference(p.g, st_buffer(sub.subtractor, 0.00001))
      end as visible_g
    from my_polys p
    left join lateral (
      select st_union(st_makevalid(o.capture_polygon)) as subtractor
      from public.activities o
      where o.status         = 'processed'
        and o.capture_polygon is not null
        and o.user_id        <> p_user_id
        and o.created_at      > p.created_at
        and o.created_at      > now() - interval '14 days'
        and o.capture_polygon && p.g
    ) sub on true
  )
  select
    coalesce((
      select sum(distance_m)::bigint
        from public.activities
       where user_id = p_user_id
         and status  = 'processed'
    ), 0) as distance_walked_m,
    coalesce((
      select st_area(st_union(visible_g)::geography)::bigint
        from visible_polys
       where not st_isempty(visible_g)
    ), 0) as area_captured_m2;
$$;

grant execute on function public.profile_zone_stats(uuid) to authenticated;
