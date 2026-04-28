-- ST_Union fails with TopologyException when capture_polygon has self-intersections.
-- Wrap with ST_MakeValid before unioning to heal any invalid geometries.

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
  )
  select
    a.user_id          as owner_id,
    p.username         as owner_username,
    p.color            as owner_color,
    max(a.created_at)  as captured_at,
    st_asgeojson(st_union(st_makevalid(a.capture_polygon)))::jsonb as geom
  from public.activities a
  join public.profiles p on p.id = a.user_id
  cross join bbox
  where a.status          = 'processed'
    and a.capture_polygon is not null
    and a.created_at      > now() - interval '14 days'
    and a.capture_polygon && bbox.g
    and st_intersects(a.capture_polygon, bbox.g)
  group by a.user_id, p.username, p.color;
$$;

grant execute on function public.zone_polygons_in_bbox(float, float, float, float) to authenticated;

-- Apply the same fix to the friends variant.
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
  )
  select
    a.user_id          as owner_id,
    p.username         as owner_username,
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
  group by a.user_id, p.username, p.color;
$$;

grant execute on function public.zone_polygons_in_bbox_friends(float, float, float, float) to authenticated;
