# Database schema

Locked decisions:
- **PostGIS** for geometry storage. SRID **4326** (WGS84) everywhere.
- **h3-pg** for hex grid. Resolution **11** (~1,770 sqm hex). Stored as `BIGINT`.
- **Coordinate order:** `(lng, lat)` in code and PostGIS. Always.
- **No ORM.** Migrations are hand-written SQL in `supabase/migrations/*.sql`. Reads/writes use `supabase-js`. Spatial queries are RPCs.
- **Every user-data table has RLS on.** Policies live in the same migration as the table.

## Extensions

```sql
-- supabase/migrations/001_extensions.sql
create extension if not exists postgis;
create extension if not exists h3;
create extension if not exists h3_postgis;     -- bridges h3 ↔ geometry types
create extension if not exists pg_net;         -- for Edge Function callbacks (v1+)
```

Enable these in the Supabase dashboard (Database → Extensions) before pushing migrations, or include them as the first migration.

## Tables

### `profiles`

Extends `auth.users` (Supabase's auth-managed table) with app-specific user fields. Created via trigger on signup.

```sql
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null,
  display_name    text not null,
  avatar_url      text,
  color           text not null default '#7F77DD',  -- hex, used for zone fill
  city            text,                              -- e.g., 'Bengaluru'
  home_geom       geometry(Point, 4326),             -- for ghost zone (v1)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_username_idx on public.profiles(username);

alter table public.profiles enable row level security;

-- Anyone can read public profile data
create policy "profiles_read_all" on public.profiles
  for select using (true);

-- Users can only update their own profile
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Inserts are handled by trigger only; no direct insert policy
```

Trigger to auto-create profile on signup:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    -- username default: derive from email, deduped with random suffix
    split_part(new.email, '@', 1) || '_' || substring(md5(random()::text), 1, 4),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### `activities`

One row per recorded activity (run, walk, cycle, hike).

```sql
create type activity_type as enum ('run', 'walk', 'cycle', 'hike');
create type activity_status as enum ('processing', 'processed', 'failed', 'rejected');

create table public.activities (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  type            activity_type not null,
  started_at      timestamptz not null,
  ended_at        timestamptz not null,
  duration_s      integer not null,
  distance_m      numeric(10, 2) not null,
  calories        integer,
  trace           geometry(LineString, 4326) not null,
  simplified      geometry(LineString, 4326),         -- post-RDP, used for capture
  capture_polygon geometry(Polygon, 4326),            -- the polygon used for cell extraction
  status          activity_status not null default 'processing',
  rejection_reason text,
  cells_captured  integer not null default 0,
  cells_lost      integer not null default 0,
  created_at      timestamptz not null default now()
);

create index activities_user_started_idx
  on public.activities(user_id, started_at desc);

create index activities_trace_gist
  on public.activities using gist(trace);

create index activities_status_idx
  on public.activities(status) where status = 'processing';

alter table public.activities enable row level security;

-- Users see their own activities; can also see friends' (via follows table; v0.5+)
create policy "activities_read_own" on public.activities
  for select using (auth.uid() = user_id);

-- No client inserts. The Edge Function (service role) handles writes.
-- Add a policy if direct inserts are ever needed.
```

### `zone_ownership`

Current owner per H3 cell. Single row per owned cell — no row means unowned.

```sql
create table public.zone_ownership (
  h3_index        bigint primary key,
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  captured_at     timestamptz not null default now(),
  captured_via    uuid not null references public.activities(id) on delete cascade,
  expires_at      timestamptz not null default (now() + interval '14 days')
);

create index zone_ownership_owner_idx on public.zone_ownership(owner_id);
create index zone_ownership_expires_idx on public.zone_ownership(expires_at);
-- Optional: precompute the centroid geometry for spatial filters.
-- Use h3_cell_to_geometry(h3_index) on read instead, since storage is cheap to skip here.

alter table public.zone_ownership enable row level security;

-- Public map: anyone can see ownership
create policy "zone_ownership_read_all" on public.zone_ownership
  for select using (true);

-- No client writes; service role only
```

### `zone_ownership_history`

Append-only audit log of every ownership change. Used for:
- Pro tier "who owned this zone" feature.
- Push targeting (we know who to notify when their zone is taken).
- Recovery / debugging.

```sql
create table public.zone_ownership_history (
  id              bigint generated always as identity primary key,
  h3_index        bigint not null,
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  captured_via    uuid not null references public.activities(id) on delete cascade,
  owned_from      timestamptz not null,
  owned_to        timestamptz                                       -- null = currently held
);

create index zone_history_h3_idx on public.zone_ownership_history(h3_index, owned_from desc);
create index zone_history_owner_idx on public.zone_ownership_history(owner_id, owned_from desc);

alter table public.zone_ownership_history enable row level security;

-- Pro tier reads; v0 keeps this restricted to service role + the owner viewing their own history
create policy "zone_history_read_own" on public.zone_ownership_history
  for select using (auth.uid() = owner_id);
```

### `follows`

Social graph. Used by friends-only feed and friends-only leaderboard in v0.5+.

```sql
create table public.follows (
  follower_id     uuid not null references public.profiles(id) on delete cascade,
  following_id    uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index follows_following_idx on public.follows(following_id);

alter table public.follows enable row level security;

create policy "follows_read_all" on public.follows
  for select using (true);

create policy "follows_insert_own" on public.follows
  for insert with check (auth.uid() = follower_id);

create policy "follows_delete_own" on public.follows
  for delete using (auth.uid() = follower_id);
```

### `push_tokens`

One row per device per user. Required for Expo Push.

```sql
create type push_platform as enum ('ios', 'android');

create table public.push_tokens (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  token           text not null,
  platform        push_platform not null,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  primary key (user_id, token)
);

create index push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens_manage_own" on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## RPC functions

These are Postgres functions called from the mobile client via `supabase.rpc()`. They centralize spatial queries the JS client can't easily express.

### `zones_in_bbox`

The map's primary read. Returns owned cells inside a bounding box, with owner color.

```sql
create or replace function public.zones_in_bbox(
  min_lng float,
  min_lat float,
  max_lng float,
  max_lat float
)
returns table (
  h3_index    bigint,
  owner_id    uuid,
  owner_username text,
  owner_color text,
  captured_at timestamptz,
  geom        jsonb        -- GeoJSON polygon for the cell
)
language sql
stable
security invoker
as $$
  with bbox as (
    select st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326) as g
  )
  select
    zo.h3_index,
    zo.owner_id,
    p.username        as owner_username,
    p.color           as owner_color,
    zo.captured_at,
    st_asgeojson(h3_cell_to_boundary_geometry(zo.h3_index))::jsonb as geom
  from public.zone_ownership zo
  join public.profiles p on p.id = zo.owner_id
  cross join bbox
  where st_intersects(h3_cell_to_boundary_geometry(zo.h3_index), bbox.g)
    and zo.expires_at > now()
  limit 5000;     -- safety cap; client should request a tighter bbox if hit
$$;

grant execute on function public.zones_in_bbox to authenticated;
```

### `cleanup_expired_zones`

Run on a schedule (pg_cron) to drop ownership rows past expiry and close out their history rows.

```sql
create or replace function public.cleanup_expired_zones()
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  -- Close out history records for soon-to-be-deleted ownership
  update public.zone_ownership_history h
     set owned_to = now()
    from public.zone_ownership zo
   where h.h3_index = zo.h3_index
     and h.owner_id = zo.owner_id
     and h.owned_to is null
     and zo.expires_at <= now();

  delete from public.zone_ownership where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Schedule it to run hourly
select cron.schedule('cleanup_expired_zones', '0 * * * *', $$ select public.cleanup_expired_zones(); $$);
```

`pg_cron` is available on Supabase but must be enabled in the dashboard.

## Indexes — summary

| Index | Purpose |
| --- | --- |
| `activities(user_id, started_at desc)` | List a user's activities (profile screen, history) |
| `activities` GIST on `trace` | Future spatial queries (e.g., "did any user pass through this area today") |
| `activities(status) where status='processing'` | Partial index — speeds up Edge Function picking up pending work |
| `zone_ownership(owner_id)` | "Show me all zones I currently own" (profile screen) |
| `zone_ownership(expires_at)` | Cron cleanup |
| `zone_ownership_history(h3_index, owned_from desc)` | Pro tier zone history view |
| `zone_ownership_history(owner_id, owned_from desc)` | "Zones you've ever owned" |
| `follows(following_id)` | "Who follows me" |
| `push_tokens(user_id)` | Push fanout |

## Migration workflow

1. `supabase migration new <descriptive_name>` — scaffolds a timestamped SQL file in `supabase/migrations/`.
2. Write idempotent SQL. Use `if not exists`, `or replace`, etc., where possible.
3. Test locally: `supabase db reset` rebuilds the local DB by replaying all migrations.
4. Push to remote: `supabase db push` (after `supabase link`).
5. Never edit a migration after it's been pushed. Write a new one.

## Seed data (dev only)

Keep `supabase/seed.sql` for local dev only. Don't run it on prod. Useful for:
- Five fake users with predictable colors.
- A handful of pre-owned zones in Koramangala for visual testing.

```sql
-- supabase/seed.sql (gitignored if it has secrets)
-- Local-only. Reset with: supabase db reset
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@dev.local'),
  ('00000000-0000-0000-0000-000000000002', 'bob@dev.local');

-- profiles get auto-created via trigger; update them here if needed
update public.profiles set color = '#E24B4A' where id = '00000000-0000-0000-0000-000000000001';
update public.profiles set color = '#1D9E75' where id = '00000000-0000-0000-0000-000000000002';
```
