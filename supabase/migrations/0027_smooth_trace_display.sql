-- 0027_smooth_trace_display.sql
--
-- Replace the simplify-only fallback for trace_geojson with a Chaikin-smoothed
-- version so saved activities render as a clean line, not a jittery one, when
-- Mapbox map-matching didn't run or returned no match.
--
-- - friends_feed: was st_simplifypreservetopology(trace, 0.00002)   (~2m, no smoothing)
-- - get_activity_detail: was st_simplifypreservetopology(trace, 0.000002) (~0.2m, no-op)
-- - my_traces_in_bbox:  was st_simplifypreservetopology(trace, 0.000002) (~0.2m, no-op)
--
-- New expression in all three: ST_ChaikinSmoothing(ST_SimplifyPreserveTopology(trace, 0.00003), 1)
-- 0.00003 ≈ 3m at Indian latitudes — coarse enough to drop GPS micro-zigzag.
-- Chaikin level 1 (single iteration) doubles vertex count once → tiny GeoJSON.
-- matched_trace (when present) still wins — Mapbox's snap is more accurate
-- than smoothing raw GPS.

create or replace function public.my_traces_in_bbox(
  min_lng float,
  min_lat float,
  max_lng float,
  max_lat float
)
returns table (
  activity_id uuid,
  geom        jsonb,
  created_at  timestamptz
)
language sql
security invoker
stable
as $$
  select
    id,
    st_asgeojson(
      coalesce(
        matched_trace,
        st_chaikinsmoothing(st_simplifypreservetopology(trace, 0.00003), 1)
      )
    )::jsonb,
    created_at
  from public.activities
  where user_id   = auth.uid()
    and status    = 'processed'
    and trace     is not null
    and st_intersects(
          coalesce(matched_trace, trace),
          st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
        )
  order by created_at desc
  limit 50;
$$;

grant execute on function public.my_traces_in_bbox(float, float, float, float) to authenticated;


create or replace function public.friends_feed(p_limit int default 20)
returns table (
  activity_id             uuid,
  user_id                 uuid,
  username                text,
  display_name            text,
  avatar_url              text,
  color                   text,
  type                    public.activity_type,
  started_at              timestamptz,
  duration_s              int,
  distance_m              numeric,
  area_captured_m2        bigint,
  calories                int,
  title                   text,
  description             text,
  visibility              public.activity_visibility,
  hide_pace               boolean,
  hide_calories           boolean,
  photo_count             int,
  cover_photo_path        text,
  like_count              int,
  comment_count           int,
  has_liked               boolean,
  capture_polygon_geojson jsonb,
  trace_geojson           jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with caller as (
    select auth.uid() as uid
  )
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
    coalesce(st_area(a.capture_polygon::geography)::bigint, 0) as area_captured_m2,
    case
      when a.user_id <> (select uid from caller) and a.hide_calories then null
      else a.calories
    end as calories,
    a.title,
    a.description,
    a.visibility,
    a.hide_pace,
    a.hide_calories,
    coalesce((select count(*)::int from public.activity_photos ph where ph.activity_id = a.id), 0) as photo_count,
    (select ph.storage_path from public.activity_photos ph
       where ph.activity_id = a.id order by ph.position asc limit 1) as cover_photo_path,
    coalesce((select count(*)::int from public.activity_likes    l where l.activity_id = a.id), 0) as like_count,
    coalesce((select count(*)::int from public.activity_comments c where c.activity_id = a.id), 0) as comment_count,
    exists (
      select 1 from public.activity_likes l
      where l.activity_id = a.id and l.user_id = (select uid from caller)
    ) as has_liked,
    case when a.capture_polygon is null then null
         else st_asgeojson(st_simplifypreservetopology(a.capture_polygon, 0.00002))::jsonb
    end as capture_polygon_geojson,
    case when a.matched_trace is null and a.trace is null then null
         else st_asgeojson(
           coalesce(
             a.matched_trace,
             st_chaikinsmoothing(st_simplifypreservetopology(a.trace, 0.00003), 1)
           )
         )::jsonb
    end as trace_geojson
  from public.activities a
  join public.profiles p on p.id = a.user_id
  where a.status = 'processed'
    and (
      a.user_id = (select uid from caller)
      or a.visibility = 'public'
      or (
        a.visibility = 'followers'
        and a.user_id in (
          select followee_id from public.follows
          where follower_id = (select uid from caller)
        )
      )
    )
  order by a.started_at desc
  limit least(p_limit, 50);
$$;

grant execute on function public.friends_feed(int) to authenticated;


create or replace function public.get_activity_detail(p_activity_id uuid)
returns table (
  activity_id              uuid,
  user_id                  uuid,
  username                 text,
  display_name             text,
  avatar_url               text,
  color                    text,
  type                     public.activity_type,
  started_at               timestamptz,
  ended_at                 timestamptz,
  duration_s               int,
  distance_m               numeric,
  area_captured_m2         bigint,
  calories                 int,
  title                    text,
  description              text,
  visibility               public.activity_visibility,
  hide_pace                boolean,
  hide_calories            boolean,
  capture_polygon_geojson  jsonb,
  trace_geojson            jsonb,
  photo_paths              text[],
  like_count               int,
  comment_count            int,
  has_liked                boolean
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
    a.ended_at,
    a.duration_s,
    a.distance_m,
    coalesce(st_area(a.capture_polygon::geography)::bigint, 0) as area_captured_m2,
    case
      when a.user_id <> auth.uid() and a.hide_calories then null
      else a.calories
    end as calories,
    a.title,
    a.description,
    a.visibility,
    a.hide_pace,
    a.hide_calories,
    case when a.capture_polygon is null then null
         else st_asgeojson(a.capture_polygon)::jsonb end as capture_polygon_geojson,
    st_asgeojson(
      coalesce(
        a.matched_trace,
        st_chaikinsmoothing(st_simplifypreservetopology(a.trace, 0.00003), 1)
      )
    )::jsonb as trace_geojson,
    coalesce(
      (select array_agg(ph.storage_path order by ph.position)
         from public.activity_photos ph where ph.activity_id = a.id),
      array[]::text[]
    ) as photo_paths,
    coalesce((select count(*)::int from public.activity_likes    l where l.activity_id = a.id), 0) as like_count,
    coalesce((select count(*)::int from public.activity_comments c where c.activity_id = a.id), 0) as comment_count,
    exists (
      select 1 from public.activity_likes l
      where l.activity_id = a.id and l.user_id = auth.uid()
    ) as has_liked
  from public.activities a
  join public.profiles p on p.id = a.user_id
  where a.id = p_activity_id
    and a.status = 'processed'
    and public.can_read_activity(a.id);
$$;

grant execute on function public.get_activity_detail(uuid) to authenticated;
