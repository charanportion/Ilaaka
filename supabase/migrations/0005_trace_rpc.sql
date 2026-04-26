-- Returns the calling user's processed activity traces intersecting the given bbox.
-- Used by the map to overlay the walking path on top of captured zones.
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
    st_asgeojson(simplified)::jsonb,
    created_at
  from public.activities
  where user_id   = auth.uid()
    and status    = 'processed'
    and simplified is not null
    and st_intersects(
          simplified,
          st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
        )
  order by created_at desc
  limit 50;
$$;

grant execute on function public.my_traces_in_bbox(float, float, float, float) to authenticated;
