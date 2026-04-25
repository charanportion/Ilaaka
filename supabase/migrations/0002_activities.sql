create type activity_type as enum ('run', 'walk', 'cycle', 'hike');
create type activity_status as enum ('processing', 'processed', 'failed', 'rejected');

create table public.activities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  type             activity_type not null,
  started_at       timestamptz not null,
  ended_at         timestamptz not null,
  duration_s       integer not null,
  distance_m       numeric(10, 2) not null,
  calories         integer,
  trace            geometry(LineString, 4326) not null,
  simplified       geometry(LineString, 4326),
  capture_polygon  geometry(Polygon, 4326),
  status           activity_status not null default 'processing',
  rejection_reason text,
  cells_captured   integer not null default 0,
  cells_lost       integer not null default 0,
  created_at       timestamptz not null default now()
);

create index activities_user_started_idx
  on public.activities(user_id, started_at desc);

create index activities_trace_gist
  on public.activities using gist(trace);

create index activities_status_idx
  on public.activities(status) where status = 'processing';

alter table public.activities enable row level security;

-- Users see their own activities only; no client inserts (Edge Function + service role writes)
create policy "activities_read_own" on public.activities
  for select using (auth.uid() = user_id);
