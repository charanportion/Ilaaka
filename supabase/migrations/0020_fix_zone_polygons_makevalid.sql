-- 0019 dropped + recreated zone_polygons_in_bbox / _friends but accidentally
-- regressed the ST_MakeValid wrapper that 0014 introduced. ST_Union then trips
-- on TopologyException ("side location conflict") whenever a capture_polygon
-- has self-touching rings or near-duplicate vertices, and the map goes blank.
-- This forward-only migration restores the wrapper.

create or replace function public.zone_polygons_in_bbox(
  min_lng float,
  min_lat float,
  max_lng float,
  max_lat float
)
returns table (
  owner_id           uuid,
  owner_username     text,
  owner_display_name text,
  owner_avatar_url   text,
  owner_color        text,
  captured_at        timestamptz,
  geom               jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with bbox as (
    select st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326) as g
  )
  select
    a.user_id          as owner_id,
    p.username         as owner_username,
    p.display_name     as owner_display_name,
    p.avatar_url       as owner_avatar_url,
    p.color            as owner_color,
    max(a.created_at)  as captured_at,
    st_asgeojson(st_union(st_makevalid(a.capture_polygon)))::jsonb as geom
  from public.activities a
  join public.profiles p on p.id = a.user_id
  cross join bbox
  where a.status         = 'processed'
    and a.capture_polygon is not null
    and a.created_at      > now() - interval '14 days'
    and a.capture_polygon && bbox.g
    and st_intersects(a.capture_polygon, bbox.g)
  group by a.user_id, p.username, p.display_name, p.avatar_url, p.color;
$$;

grant execute on function public.zone_polygons_in_bbox(float, float, float, float) to authenticated;


create or replace function public.zone_polygons_in_bbox_friends(
  min_lng float,
  min_lat float,
  max_lng float,
  max_lat float
)
returns table (
  owner_id           uuid,
  owner_username     text,
  owner_display_name text,
  owner_avatar_url   text,
  owner_color        text,
  captured_at        timestamptz,
  geom               jsonb
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
  )
  select
    a.user_id          as owner_id,
    p.username         as owner_username,
    p.display_name     as owner_display_name,
    p.avatar_url       as owner_avatar_url,
    p.color            as owner_color,
    max(a.created_at)  as captured_at,
    st_asgeojson(st_union(st_makevalid(a.capture_polygon)))::jsonb as geom
  from public.activities a
  join public.profiles p on p.id = a.user_id
  join visible_users   vu on vu.uid = a.user_id
  cross join bbox
  where a.status          = 'processed'
    and a.capture_polygon is not null
    and a.created_at      > now() - interval '14 days'
    and a.capture_polygon && bbox.g
    and st_intersects(a.capture_polygon, bbox.g)
  group by a.user_id, p.username, p.display_name, p.avatar_url, p.color;
$$;

grant execute on function public.zone_polygons_in_bbox_friends(float, float, float, float) to authenticated;
