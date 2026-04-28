-- Phase 6: tap-a-zone → see whose territory it is, then open their public profile.
--
-- 1. zone_polygons_in_bbox / _friends now also return display_name + avatar_url
--    so the map info card can render a richer owner identity.
-- 2. user_public_profile(p_user_id): identity + lifetime stats for any user.
-- 3. user_recent_activities(p_user_id, p_limit): metadata-only activity list
--    (NEVER exposes trace / matched_trace / capture_polygon — see CLAUDE.md rule 4).

-- ── zone_polygons_in_bbox: add owner_display_name + owner_avatar_url ──────────

drop function if exists public.zone_polygons_in_bbox(float, float, float, float);

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


-- ── zone_polygons_in_bbox_friends: same additions ────────────────────────────

drop function if exists public.zone_polygons_in_bbox_friends(float, float, float, float);

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


-- ── user_public_profile ──────────────────────────────────────────────────────
-- Mirrors profile_zone_stats area logic (subtract displaced territory) so the
-- "Area captured" number on a public profile matches what the user sees on
-- their own profile and what's actually visible on the map.
-- security definer because activities RLS is read-own only.

create or replace function public.user_public_profile(p_user_id uuid)
returns table (
  id                uuid,
  username          text,
  display_name      text,
  avatar_url        text,
  color             text,
  total_distance_m  bigint,
  total_area_m2     bigint,
  total_calories    bigint,
  total_activities  int,
  is_following      boolean
)
language sql
stable
security definer
set search_path = public
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
    pr.id,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    pr.color,
    coalesce((
      select sum(distance_m)::bigint
        from public.activities
       where user_id = p_user_id
         and status  = 'processed'
    ), 0) as total_distance_m,
    coalesce((
      select st_area(st_union(visible_g)::geography)::bigint
        from visible_polys
       where not st_isempty(visible_g)
    ), 0) as total_area_m2,
    coalesce((
      select sum(coalesce(calories, 0))::bigint
        from public.activities
       where user_id = p_user_id
         and status  = 'processed'
    ), 0) as total_calories,
    coalesce((
      select count(*)::int
        from public.activities
       where user_id = p_user_id
         and status  = 'processed'
    ), 0) as total_activities,
    exists(
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.followee_id = p_user_id
    ) as is_following
  from public.profiles pr
  where pr.id = p_user_id;
$$;

grant execute on function public.user_public_profile(uuid) to authenticated;


-- ── user_recent_activities ───────────────────────────────────────────────────
-- Activity list for any user. Returns ONLY metadata — no GPS, no polygons.

create or replace function public.user_recent_activities(
  p_user_id uuid,
  p_limit   int default 10
)
returns table (
  activity_id      uuid,
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
    a.id,
    a.type,
    a.started_at,
    a.duration_s,
    a.distance_m,
    coalesce(st_area(a.capture_polygon::geography)::bigint, 0) as area_captured_m2,
    a.calories
  from public.activities a
  where a.user_id = p_user_id
    and a.status  = 'processed'
  order by a.started_at desc
  limit least(p_limit, 50);
$$;

grant execute on function public.user_recent_activities(uuid, int) to authenticated;
