-- Make zone display reflect ownership transfers.
-- For each user's territory, subtract the union of any later-and-overlapping
-- polygons captured by other users. "Later wins" matches zone_ownership semantics.

create or replace function public.zone_polygons_in_bbox(
  min_lng float,
  min_lat float,
  max_lng float,
  max_lat float
)
returns table (
  owner_id       uuid,
  owner_username text,
  owner_color    text,
  captured_at    timestamptz,
  geom           jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with bbox as (
    select st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326) as g
  ),
  my_polys as (
    select a.id, a.user_id, a.created_at,
           st_makevalid(a.capture_polygon) as g
    from public.activities a
    cross join bbox
    where a.status          = 'processed'
      and a.capture_polygon is not null
      and a.created_at      > now() - interval '14 days'
      and a.capture_polygon && bbox.g
      and st_intersects(a.capture_polygon, bbox.g)
  ),
  visible_polys as (
    select
      p.user_id,
      p.created_at,
      case
        when sub.subtractor is null then p.g
        else st_difference(p.g, sub.subtractor)
      end as visible_g
    from my_polys p
    left join lateral (
      select st_union(p2.g) as subtractor
      from my_polys p2
      where p2.created_at > p.created_at
        and p2.user_id   <> p.user_id
        and p2.g && p.g
    ) sub on true
  )
  select
    vp.user_id         as owner_id,
    pr.username        as owner_username,
    pr.color           as owner_color,
    max(vp.created_at) as captured_at,
    st_asgeojson(st_union(vp.visible_g))::jsonb as geom
  from visible_polys vp
  join public.profiles pr on pr.id = vp.user_id
  where not st_isempty(vp.visible_g)
  group by vp.user_id, pr.username, pr.color;
$$;

grant execute on function public.zone_polygons_in_bbox(float, float, float, float) to authenticated;

create or replace function public.zone_polygons_in_bbox_friends(
  min_lng float,
  min_lat float,
  max_lng float,
  max_lat float
)
returns table (
  owner_id       uuid,
  owner_username text,
  owner_color    text,
  captured_at    timestamptz,
  geom           jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with bbox as (
    select st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326) as g
  ),
  visible_users as (
    select followee_id as uid from public.follows where follower_id = auth.uid()
    union
    select auth.uid() as uid
  ),
  my_polys as (
    select a.id, a.user_id, a.created_at,
           st_makevalid(a.capture_polygon) as g
    from public.activities a
    join visible_users vu on vu.uid = a.user_id
    cross join bbox
    where a.status          = 'processed'
      and a.capture_polygon is not null
      and a.created_at      > now() - interval '14 days'
      and a.capture_polygon && bbox.g
      and st_intersects(a.capture_polygon, bbox.g)
  ),
  visible_polys as (
    select
      p.user_id,
      p.created_at,
      case
        when sub.subtractor is null then p.g
        else st_difference(p.g, sub.subtractor)
      end as visible_g
    from my_polys p
    left join lateral (
      select st_union(p2.g) as subtractor
      from my_polys p2
      where p2.created_at > p.created_at
        and p2.user_id   <> p.user_id
        and p2.g && p.g
    ) sub on true
  )
  select
    vp.user_id         as owner_id,
    pr.username        as owner_username,
    pr.color           as owner_color,
    max(vp.created_at) as captured_at,
    st_asgeojson(st_union(vp.visible_g))::jsonb as geom
  from visible_polys vp
  join public.profiles pr on pr.id = vp.user_id
  where not st_isempty(vp.visible_g)
  group by vp.user_id, pr.username, pr.color;
$$;

grant execute on function public.zone_polygons_in_bbox_friends(float, float, float, float) to authenticated;
