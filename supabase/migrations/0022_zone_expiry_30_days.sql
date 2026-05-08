-- Phase 6: extend zone expiry from 14 → 30 days, and add an hourly cleanup cron
-- that actually deletes expired rows from zone_ownership so the table doesn't
-- grow forever.

-- ── Table default ────────────────────────────────────────────────────────────
alter table public.zone_ownership
  alter column expires_at set default (now() + interval '30 days');

-- Re-baseline existing rows: any row's expiry is now (captured_at + 30 days).
-- This avoids previously-captured zones quietly disappearing under the new rule.
update public.zone_ownership
   set expires_at = captured_at + interval '30 days';

-- ── capture_activity: 14 → 30 days for new captures ──────────────────────────
create or replace function public.capture_activity(
  p_activity_id    uuid,
  p_cells          text[],
  p_boundaries_wkt text[]
)
returns table (cells_captured integer, displaced jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid;
  v_cells_bi   bigint[];
  v_displaced  jsonb;
  v_cell_count integer;
begin
  select user_id into v_user_id
    from public.activities
   where id = p_activity_id;

  if v_user_id is null then
    raise exception 'activity not found: %', p_activity_id;
  end if;

  select array_agg(c::bigint) into v_cells_bi
    from unnest(p_cells) c;

  v_cell_count := coalesce(array_length(v_cells_bi, 1), 0);

  if v_cell_count < 3 then
    update public.activities
       set status           = 'rejected',
           rejection_reason = 'too_few_cells',
           cells_captured   = v_cell_count
     where id = p_activity_id;
    return query select 0::integer, '[]'::jsonb;
    return;
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('owner_id', owner_id, 'count', cnt)),
    '[]'::jsonb
  )
    into v_displaced
    from (
      select owner_id, count(*) as cnt
        from public.zone_ownership
       where h3_index = any(v_cells_bi)
         and owner_id <> v_user_id
       group by owner_id
    ) d;

  update public.zone_ownership_history h
     set owned_to = now()
    from public.zone_ownership zo
   where zo.h3_index  = any(v_cells_bi)
     and h.h3_index   = zo.h3_index
     and h.owner_id   = zo.owner_id
     and h.owned_to   is null
     and zo.owner_id <> v_user_id;

  insert into public.zone_ownership
        (h3_index, owner_id, captured_at, captured_via, expires_at, boundary)
  select
    p_cells[i]::bigint,
    v_user_id,
    now(),
    p_activity_id,
    now() + interval '30 days',
    st_geomfromtext(p_boundaries_wkt[i], 4326)
  from generate_series(1, array_length(p_cells, 1)) as i
  on conflict (h3_index) do update set
    owner_id     = excluded.owner_id,
    captured_at  = excluded.captured_at,
    captured_via = excluded.captured_via,
    expires_at   = excluded.expires_at,
    boundary     = excluded.boundary;

  insert into public.zone_ownership_history
        (h3_index, owner_id, captured_via, owned_from)
  select p_cells[i]::bigint, v_user_id, p_activity_id, now()
    from generate_series(1, array_length(p_cells, 1)) as i;

  update public.activities
     set status         = 'processed',
         cells_captured = v_cell_count,
         cells_lost     = (
           select coalesce(sum((d->>'count')::integer), 0)
             from jsonb_array_elements(v_displaced) as d
         )
   where id = p_activity_id;

  return query select v_cell_count, v_displaced;
end;
$$;

-- ── Display RPCs: 14 → 30 days for the activity-recency filter ───────────────

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
    and a.created_at      > now() - interval '30 days'
    and a.capture_polygon && bbox.g
    and st_intersects(a.capture_polygon, bbox.g)
  group by a.user_id, p.username, p.display_name, p.avatar_url, p.color;
$$;

grant execute on function public.zone_polygons_in_bbox(float, float, float, float) to authenticated;


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
    and a.created_at      > now() - interval '30 days'
    and a.capture_polygon && bbox.g
    and st_intersects(a.capture_polygon, bbox.g)
  group by a.user_id, p.username, p.display_name, p.avatar_url, p.color;
$$;

grant execute on function public.zone_polygons_in_bbox_friends(float, float, float, float) to authenticated;


-- ── profile_zone_stats: 14 → 30 days ─────────────────────────────────────────
create or replace function public.profile_zone_stats(p_user_id uuid)
returns table (
  distance_walked_m bigint,
  area_captured_m2  bigint
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
      and a.created_at      > now() - interval '30 days'
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
        and o.created_at      > now() - interval '30 days'
        and o.capture_polygon && p.g
    ) sub on true
  )
  select
    coalesce((
      select sum(distance_m)::bigint
        from public.activities
       where user_id = p_user_id
         and status  = 'processed'
    ), 0) as distance_walked_m,
    coalesce((
      select st_area(st_union(visible_g)::geography)::bigint
        from visible_polys
       where not st_isempty(visible_g)
    ), 0) as area_captured_m2;
$$;

grant execute on function public.profile_zone_stats(uuid) to authenticated;


-- ── user_public_profile: 14 → 30 days ────────────────────────────────────────
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
      and a.created_at      > now() - interval '30 days'
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
        and o.created_at      > now() - interval '30 days'
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


-- ── cleanup_expired_zones: deletes rows whose expires_at has passed ──────────
create or replace function public.cleanup_expired_zones()
returns int
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.zone_ownership
     where expires_at < now()
    returning 1
  )
  select coalesce(count(*)::int, 0) from deleted;
$$;

grant execute on function public.cleanup_expired_zones() to service_role;


-- ── pg_cron schedule: hourly at :00 ──────────────────────────────────────────
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('cleanup-expired-zones');
exception when others then
  null;
end $$;

select cron.schedule(
  'cleanup-expired-zones',
  '0 * * * *',
  $cron$ select public.cleanup_expired_zones(); $cron$
);
