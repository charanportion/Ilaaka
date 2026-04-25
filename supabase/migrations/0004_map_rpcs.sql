-- zones_in_bbox: primary map read — returns owned cells inside a viewport.
-- Uses the boundary GIST index from 0003 for fast spatial filtering.
-- h3_index is cast to text because bigint H3 values exceed JS Number.MAX_SAFE_INTEGER.
create or replace function public.zones_in_bbox(
  min_lng float,
  min_lat float,
  max_lng float,
  max_lat float
)
returns table (
  h3_index       text,
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
    zo.h3_index::text,
    zo.owner_id,
    p.username       as owner_username,
    p.color          as owner_color,
    zo.captured_at,
    st_asgeojson(zo.boundary)::jsonb as geom
  from public.zone_ownership zo
  join public.profiles p on p.id = zo.owner_id
  cross join bbox
  where zo.boundary && bbox.g
    and st_intersects(zo.boundary, bbox.g)
    and zo.expires_at > now()
  limit 5000;
$$;

grant execute on function public.zones_in_bbox(float, float, float, float) to authenticated;

-- profile_zone_stats: hexes owned now + all-time captured count for a user.
-- cells_captured_alltime reads zone_ownership_history which has RLS zone_history_read_own,
-- so this only returns a non-zero count when auth.uid() = p_user_id (your own profile).
create or replace function public.profile_zone_stats(p_user_id uuid)
returns table (cells_owned integer, cells_captured_alltime integer)
language sql
stable
security invoker
as $$
  select
    (
      select count(*)::integer
        from public.zone_ownership
       where owner_id  = p_user_id
         and expires_at > now()
    ) as cells_owned,
    (
      select count(*)::integer
        from public.zone_ownership_history
       where owner_id = p_user_id
    ) as cells_captured_alltime;
$$;

grant execute on function public.profile_zone_stats(uuid) to authenticated;
