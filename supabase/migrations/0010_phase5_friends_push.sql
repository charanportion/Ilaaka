-- Phase 5: social graph (follows) + push notification tokens
-- All RLS policies for new tables are in this file.

-- ── push_tokens ────────────────────────────────────────────────────────────────
-- Stores Expo push tokens per device.
-- unique(token) means a reinstall / account-switch upsert just reassigns user_id.

create table public.push_tokens (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  token        text        not null unique,
  device_id    text,
  platform     text        not null check (platform in ('ios', 'android', 'web')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens_select_own" on public.push_tokens
  for select using (auth.uid() = user_id);

create policy "push_tokens_insert_own" on public.push_tokens
  for insert with check (auth.uid() = user_id);

create policy "push_tokens_update_own" on public.push_tokens
  for update using (auth.uid() = user_id);

create policy "push_tokens_delete_own" on public.push_tokens
  for delete using (auth.uid() = user_id);

-- ── follows ────────────────────────────────────────────────────────────────────
-- Directed follow graph. Composite PK prevents duplicates.
-- CHECK prevents self-follow without a trigger.

create table public.follows (
  follower_id  uuid        not null references public.profiles(id) on delete cascade,
  followee_id  uuid        not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows(followee_id);

alter table public.follows enable row level security;

-- Users can see follows they are party to (either side), but not the full graph.
create policy "follows_select_self_party" on public.follows
  for select using (auth.uid() = follower_id or auth.uid() = followee_id);

create policy "follows_insert_own" on public.follows
  for insert with check (auth.uid() = follower_id);

create policy "follows_delete_own" on public.follows
  for delete using (auth.uid() = follower_id);

-- ── RPC: upsert_push_token ──────────────────────────────────────────────────────
-- Atomic insert-or-reassign. Handles reinstalls: new user wins the token row.

create or replace function public.upsert_push_token(
  p_token     text,
  p_platform  text,
  p_device_id text default null
)
returns void
language sql
security invoker
as $$
  insert into public.push_tokens (user_id, token, platform, device_id, last_seen_at)
  values (auth.uid(), p_token, p_platform, p_device_id, now())
  on conflict (token) do update
    set user_id      = excluded.user_id,
        platform     = excluded.platform,
        device_id    = excluded.device_id,
        last_seen_at = now();
$$;

grant execute on function public.upsert_push_token(text, text, text) to authenticated;

-- ── RPC: search_users ──────────────────────────────────────────────────────────
-- Case-insensitive prefix search on username, substring on display_name.
-- Returns whether the calling user already follows each result.

create or replace function public.search_users(q text)
returns table (
  id           uuid,
  username     text,
  display_name text,
  avatar_url   text,
  color        text,
  is_following boolean
)
language sql
stable
security invoker
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.color,
    exists(
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.followee_id = p.id
    ) as is_following
  from public.profiles p
  where
    length(q) >= 2
    and p.id <> auth.uid()
    and (
      p.username     ilike q || '%'
      or p.display_name ilike '%' || q || '%'
    )
  order by p.username
  limit 20;
$$;

grant execute on function public.search_users(text) to authenticated;

-- ── RPC: zone_polygons_in_bbox_friends ─────────────────────────────────────────
-- Same return shape as zone_polygons_in_bbox but scoped to:
--   (a) users the caller follows, and
--   (b) the caller themselves.
-- SECURITY DEFINER because activities RLS is read_own only.

create or replace function public.zone_polygons_in_bbox_friends(
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
  ),
  visible_users as (
    select followee_id as uid from public.follows where follower_id = auth.uid()
    union
    select auth.uid() as uid
  )
  select
    a.user_id          as owner_id,
    p.username         as owner_username,
    p.color            as owner_color,
    max(a.created_at)  as captured_at,
    st_asgeojson(st_union(a.capture_polygon))::jsonb as geom
  from public.activities a
  join public.profiles p on p.id = a.user_id
  join visible_users   vu on vu.uid = a.user_id
  cross join bbox
  where a.status          = 'processed'
    and a.capture_polygon is not null
    and a.created_at      > now() - interval '14 days'
    and a.capture_polygon && bbox.g
    and st_intersects(a.capture_polygon, bbox.g)
  group by a.user_id, p.username, p.color;
$$;

grant execute on function public.zone_polygons_in_bbox_friends(float, float, float, float) to authenticated;

-- ── RPC: friends_feed ──────────────────────────────────────────────────────────
-- Last N processed activities by the caller and people they follow.
-- SECURITY DEFINER because activities RLS is read_own only.
-- Never exposes trace / matched_trace / capture_polygon (GPS privacy rule).

create or replace function public.friends_feed(p_limit int default 20)
returns table (
  activity_id    uuid,
  user_id        uuid,
  username       text,
  display_name   text,
  avatar_url     text,
  color          text,
  type           public.activity_type,
  started_at     timestamptz,
  duration_s     int,
  distance_m     numeric,
  cells_captured int,
  cells_lost     int
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
    a.duration_s,
    a.distance_m,
    coalesce(a.cells_captured, 0) as cells_captured,
    coalesce(a.cells_lost,     0) as cells_lost
  from public.activities a
  join public.profiles p on p.id = a.user_id
  where a.status = 'processed'
    and (
      a.user_id = auth.uid()
      or a.user_id in (
        select followee_id from public.follows where follower_id = auth.uid()
      )
    )
  order by a.started_at desc
  limit least(p_limit, 50);
$$;

grant execute on function public.friends_feed(int) to authenticated;

-- ── RPC: followers_for_owner ───────────────────────────────────────────────────
-- Returns follower IDs for a given owner.
-- Used by the Edge Function for push fan-out (service role bypasses RLS,
-- but we gate this fn to service_role to keep it off the anon surface).

create or replace function public.followers_for_owner(p_owner_id uuid)
returns table (follower_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select follower_id from public.follows where followee_id = p_owner_id;
$$;

grant execute on function public.followers_for_owner(uuid) to service_role;
