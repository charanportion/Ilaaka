-- Fix 1: prepare_capture_polygon — return a 15 m-expanded polygon to h3-js
-- so cells whose center is just outside the walked boundary are still captured.
-- The stored capture_polygon column keeps the accurate boundary.
create or replace function public.prepare_capture_polygon(p_activity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_simplified      geometry;
  v_polygon         geometry;
  v_polygon_for_h3  geometry;
  v_start           geometry;
  v_end             geometry;
begin
  select st_simplifypreservetopology(trace, 0.00005)
    into v_simplified
    from public.activities
   where id = p_activity_id;

  if v_simplified is null then
    raise exception 'activity not found: %', p_activity_id;
  end if;

  v_start := st_startpoint(v_simplified);
  v_end   := st_endpoint(v_simplified);

  if st_distance(v_start::geography, v_end::geography) < 100
     and st_numpoints(v_simplified) >= 4 then
    -- Closed loop: seal into a polygon, then expand 15 m so edge cells are captured
    v_polygon        := st_makepolygon(st_addpoint(v_simplified, v_start));
    v_polygon_for_h3 := st_buffer(v_polygon::geography, 15)::geometry;
  else
    -- Open route: 25 m corridor — use as-is for both storage and h3-js
    v_polygon        := st_buffer(v_simplified::geography, 25)::geometry;
    v_polygon_for_h3 := v_polygon;
  end if;

  update public.activities
     set simplified      = v_simplified,
         capture_polygon = v_polygon       -- accurate boundary stored
   where id = p_activity_id;

  -- Return the h3-js polygon (slightly expanded for loops)
  return st_asgeojson(v_polygon_for_h3)::jsonb;
end;
$$;

grant execute on function public.prepare_capture_polygon(uuid) to service_role;


-- Fix 2: my_traces_in_bbox — use raw GPS trace with very light simplification
-- (0.000002 deg ≈ 0.2 m tolerance) instead of the aggressively simplified column,
-- giving Strava-style density and smooth curves.
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
      st_simplifypreservetopology(trace, 0.000002)
    )::jsonb,
    created_at
  from public.activities
  where user_id   = auth.uid()
    and status    = 'processed'
    and trace     is not null
    and st_intersects(
          trace,
          st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
        )
  order by created_at desc
  limit 50;
$$;

grant execute on function public.my_traces_in_bbox(float, float, float, float) to authenticated;
