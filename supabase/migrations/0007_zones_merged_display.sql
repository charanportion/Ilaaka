-- zones_merged_in_bbox: returns one merged polygon per owner instead of
-- individual H3 cells. ST_Union dissolves internal hex borders so adjacent
-- cells become a single smooth shape (no visible hex grid on the map).
create or replace function public.zones_merged_in_bbox(
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
security invoker
as $$
  with bbox as (
    select st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326) as g
  )
  select
    zo.owner_id,
    p.username          as owner_username,
    p.color             as owner_color,
    max(zo.captured_at) as captured_at,
    st_asgeojson(st_union(zo.boundary))::jsonb as geom
  from public.zone_ownership zo
  join public.profiles p on p.id = zo.owner_id
  cross join bbox
  where zo.boundary && bbox.g
    and st_intersects(zo.boundary, bbox.g)
    and zo.expires_at > now()
  group by zo.owner_id, p.username, p.color;
$$;

grant execute on function public.zones_merged_in_bbox(float, float, float, float) to authenticated;
