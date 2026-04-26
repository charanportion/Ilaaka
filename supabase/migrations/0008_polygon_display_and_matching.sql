-- Snapped-to-roads polyline produced by Mapbox Map Matching API.
-- Filled in best-effort by the submit-activity Edge Function after capture.
alter table public.activities
  add column if not exists matched_trace geometry(LineString, 4326);

create index if not exists activities_matched_trace_gix
  on public.activities using gist(matched_trace);


-- zone_polygons_in_bbox: per-user merged capture polygons for map display.
-- Replaces hex-grid display with the actual smooth shape each user walked.
-- SECURITY DEFINER because activities RLS restricts to own rows; we expose
-- only the polygon geometry and owner display fields, never the raw GPS trace.
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
    st_asgeojson(st_union(a.capture_polygon))::jsonb as geom
  from public.activities a
  join public.profiles p on p.id = a.user_id
  cross join bbox
  where a.status         = 'processed'
    and a.capture_polygon is not null
    and a.created_at      > now() - interval '14 days'
    and a.capture_polygon && bbox.g
    and st_intersects(a.capture_polygon, bbox.g)
  group by a.user_id, p.username, p.color;
$$;

grant execute on function public.zone_polygons_in_bbox(float, float, float, float) to authenticated;


-- set_matched_trace: helper for the Edge Function to write GeoJSON LineString
-- into the matched_trace geometry column without raw SQL string interpolation.
create or replace function public.set_matched_trace(
  p_activity_id     uuid,
  p_matched_geojson jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.activities
     set matched_trace = st_setsrid(st_geomfromgeojson(p_matched_geojson), 4326)
   where id = p_activity_id;
$$;

grant execute on function public.set_matched_trace(uuid, jsonb) to service_role;


-- my_traces_in_bbox: prefer matched_trace (snapped to roads) over raw GPS.
-- Falls back to lightly-simplified raw trace if matching never ran or failed.
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
      coalesce(matched_trace, st_simplifypreservetopology(trace, 0.000002))
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
