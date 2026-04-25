-- zone_ownership: current owner per H3 cell.
-- boundary stores the h3-js-precomputed polygon because h3_cell_to_boundary_geometry()
-- is unavailable on this Supabase instance (h3 extension not loaded).
create table public.zone_ownership (
  h3_index     bigint primary key,
  owner_id     uuid not null references public.profiles(id)   on delete cascade,
  captured_at  timestamptz not null default now(),
  captured_via uuid not null references public.activities(id) on delete cascade,
  expires_at   timestamptz not null default (now() + interval '14 days'),
  boundary     geometry(Polygon, 4326) not null
);

create index zone_ownership_owner_idx    on public.zone_ownership(owner_id);
create index zone_ownership_expires_idx  on public.zone_ownership(expires_at);
create index zone_ownership_boundary_gix on public.zone_ownership using gist(boundary);

alter table public.zone_ownership enable row level security;

create policy "zone_ownership_read_all" on public.zone_ownership
  for select using (true);

-- zone_ownership_history: append-only audit log of every ownership change.
create table public.zone_ownership_history (
  id           bigint generated always as identity primary key,
  h3_index     bigint not null,
  owner_id     uuid not null references public.profiles(id)   on delete cascade,
  captured_via uuid not null references public.activities(id) on delete cascade,
  owned_from   timestamptz not null,
  owned_to     timestamptz  -- null = currently held
);

create index zone_history_h3_idx    on public.zone_ownership_history(h3_index,  owned_from desc);
create index zone_history_owner_idx on public.zone_ownership_history(owner_id,  owned_from desc);

alter table public.zone_ownership_history enable row level security;

create policy "zone_history_read_own" on public.zone_ownership_history
  for select using (auth.uid() = owner_id);

-- prepare_capture_polygon: simplifies the GPS trace, builds the capture polygon,
-- persists both on the activities row, and returns the polygon as GeoJSON for the
-- Edge Function to pass to h3-js.
create or replace function public.prepare_capture_polygon(p_activity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_simplified geometry;
  v_polygon    geometry;
  v_start      geometry;
  v_end        geometry;
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

  if st_distance(v_start::geography, v_end::geography) < 30 then
    -- Closed loop: seal it into a polygon
    v_polygon := st_makepolygon(st_addpoint(v_simplified, v_start));
  else
    -- Open route: 25 m corridor
    v_polygon := st_buffer(v_simplified::geography, 25)::geometry;
  end if;

  update public.activities
     set simplified      = v_simplified,
         capture_polygon = v_polygon
   where id = p_activity_id;

  return st_asgeojson(v_polygon)::jsonb;
end;
$$;

grant execute on function public.prepare_capture_polygon(uuid) to service_role;

-- capture_activity: atomically claims H3 cells and updates ownership records.
-- p_cells:          decimal-string representations of bigint H3 indexes
-- p_boundaries_wkt: WKT POLYGON strings, one per cell (same order as p_cells)
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

  -- Displaced owners (excludes self-recapture)
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

  -- Close open history rows for displaced owners
  update public.zone_ownership_history h
     set owned_to = now()
    from public.zone_ownership zo
   where zo.h3_index  = any(v_cells_bi)
     and h.h3_index   = zo.h3_index
     and h.owner_id   = zo.owner_id
     and h.owned_to   is null
     and zo.owner_id <> v_user_id;

  -- Upsert ownership; boundary comes from h3-js via the Edge Function
  insert into public.zone_ownership
        (h3_index, owner_id, captured_at, captured_via, expires_at, boundary)
  select
    p_cells[i]::bigint,
    v_user_id,
    now(),
    p_activity_id,
    now() + interval '14 days',
    st_geomfromtext(p_boundaries_wkt[i], 4326)
  from generate_series(1, array_length(p_cells, 1)) as i
  on conflict (h3_index) do update set
    owner_id     = excluded.owner_id,
    captured_at  = excluded.captured_at,
    captured_via = excluded.captured_via,
    expires_at   = excluded.expires_at,
    boundary     = excluded.boundary;

  -- New history rows for this activity
  insert into public.zone_ownership_history
        (h3_index, owner_id, captured_via, owned_from)
  select p_cells[i]::bigint, v_user_id, p_activity_id, now()
    from generate_series(1, array_length(p_cells, 1)) as i;

  -- Mark activity processed
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

grant execute on function public.capture_activity(uuid, text[], text[]) to service_role;
