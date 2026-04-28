-- Phase 7: rich activity metadata + social interactions.
-- Adds title/description/visibility/hide_* columns to activities, plus
-- activity_photos, activity_likes, activity_comments tables and the RPCs
-- the mobile feed/detail screens use.

-- ── 1. activity_visibility enum ────────────────────────────────────────────────

create type public.activity_visibility as enum ('public', 'followers', 'private');

-- ── 2. Extend activities ───────────────────────────────────────────────────────

alter table public.activities
  add column title         text,
  add column description   text,
  add column visibility    public.activity_visibility not null default 'public',
  add column hide_pace     boolean not null default false,
  add column hide_calories boolean not null default false;

alter table public.activities
  add constraint activities_title_len_chk       check (title       is null or char_length(title)       <= 80),
  add constraint activities_description_len_chk check (description is null or char_length(description) <= 2000);

-- Helps the feed query: finished public activities by recency
create index activities_visibility_started_at_idx
  on public.activities (visibility, started_at desc)
  where status = 'processed';

-- ── 3. Visibility helper used by every social RLS policy ──────────────────────

create or replace function public.can_read_activity(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.activities a
    where a.id = p_activity_id
      and (
        a.user_id = auth.uid()
        or a.visibility = 'public'
        or (
          a.visibility = 'followers'
          and exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid() and f.followee_id = a.user_id
          )
        )
      )
  );
$$;

grant execute on function public.can_read_activity(uuid) to authenticated;

-- ── 4. Update activities read policy to honour visibility ─────────────────────

drop policy if exists "activities_read_own" on public.activities;

create policy "activities_read_visible" on public.activities
  for select using (
    auth.uid() = user_id
    or visibility = 'public'
    or (
      visibility = 'followers'
      and exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid() and f.followee_id = user_id
      )
    )
  );

-- Owner can update their own metadata (title/description/visibility/hide_*).
-- The Edge Function uses service role for the spatial fields so this is safe.
create policy "activities_update_own_metadata" on public.activities
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 5. activity_photos ────────────────────────────────────────────────────────

create table public.activity_photos (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.activities(id) on delete cascade,
  user_id      uuid not null references public.profiles(id)   on delete cascade,
  storage_path text not null,
  position     smallint not null default 0,
  created_at   timestamptz not null default now(),
  unique (activity_id, position)
);

create index activity_photos_activity_idx on public.activity_photos (activity_id, position);

alter table public.activity_photos enable row level security;

create policy "activity_photos_read" on public.activity_photos
  for select using (public.can_read_activity(activity_id));

create policy "activity_photos_insert_own" on public.activity_photos
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.activities a
      where a.id = activity_id and a.user_id = auth.uid()
    )
  );

create policy "activity_photos_delete_own" on public.activity_photos
  for delete using (auth.uid() = user_id);

-- 5-photo cap. CHECK can't subquery, so trigger.
create or replace function public.enforce_activity_photo_cap()
returns trigger
language plpgsql
as $$
declare
  c int;
begin
  select count(*) into c from public.activity_photos where activity_id = new.activity_id;
  if c >= 5 then
    raise exception 'photo_cap_reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger activity_photo_cap
  before insert on public.activity_photos
  for each row execute function public.enforce_activity_photo_cap();

-- ── 6. activity_likes ─────────────────────────────────────────────────────────

create table public.activity_likes (
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id     uuid not null references public.profiles(id)   on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index activity_likes_user_idx on public.activity_likes (user_id, created_at desc);

alter table public.activity_likes enable row level security;

create policy "activity_likes_read" on public.activity_likes
  for select using (public.can_read_activity(activity_id));

create policy "activity_likes_insert_own" on public.activity_likes
  for insert with check (
    auth.uid() = user_id and public.can_read_activity(activity_id)
  );

create policy "activity_likes_delete_own" on public.activity_likes
  for delete using (auth.uid() = user_id);

-- ── 7. activity_comments ──────────────────────────────────────────────────────

create table public.activity_comments (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id     uuid not null references public.profiles(id)   on delete cascade,
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index activity_comments_activity_idx on public.activity_comments (activity_id, created_at desc);

alter table public.activity_comments enable row level security;

create policy "activity_comments_read" on public.activity_comments
  for select using (public.can_read_activity(activity_id));

create policy "activity_comments_insert_own" on public.activity_comments
  for insert with check (
    auth.uid() = user_id and public.can_read_activity(activity_id)
  );

create policy "activity_comments_update_own" on public.activity_comments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Either commenter or activity owner can delete a comment.
create policy "activity_comments_delete_own_or_owner" on public.activity_comments
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.activities a
      where a.id = activity_id and a.user_id = auth.uid()
    )
  );

-- ── 8. activity-photos storage bucket ─────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'activity-photos',
  'activity-photos',
  true,
  5 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
   set public             = excluded.public,
       file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "activity_photos_read_all"   on storage.objects;
drop policy if exists "activity_photos_insert_own" on storage.objects;
drop policy if exists "activity_photos_update_own" on storage.objects;
drop policy if exists "activity_photos_delete_own" on storage.objects;

create policy "activity_photos_read_all" on storage.objects
  for select
  using (bucket_id = 'activity-photos');

-- Path layout: <user_id>/<activity_id>/<n>.jpg or <user_id>/draft/<local_id>/<n>.jpg.
-- First path segment is always the user_id and writes are scoped to it.
create policy "activity_photos_insert_own" on storage.objects
  for insert
  with check (
    bucket_id = 'activity-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "activity_photos_update_own" on storage.objects
  for update
  using (
    bucket_id = 'activity-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "activity_photos_delete_own" on storage.objects
  for delete
  using (
    bucket_id = 'activity-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── 9. RPCs ───────────────────────────────────────────────────────────────────

-- friends_feed: replaces 0013 with metadata + social counts and visibility filter.

drop function if exists public.friends_feed(int);

create or replace function public.friends_feed(p_limit int default 20)
returns table (
  activity_id             uuid,
  user_id                 uuid,
  username                text,
  display_name            text,
  avatar_url              text,
  color                   text,
  type                    public.activity_type,
  started_at              timestamptz,
  duration_s              int,
  distance_m              numeric,
  area_captured_m2        bigint,
  calories                int,
  title                   text,
  description             text,
  visibility              public.activity_visibility,
  hide_pace               boolean,
  hide_calories           boolean,
  photo_count             int,
  cover_photo_path        text,
  like_count              int,
  comment_count           int,
  has_liked               boolean,
  capture_polygon_geojson jsonb,
  trace_geojson           jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with caller as (
    select auth.uid() as uid
  )
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
    coalesce(st_area(a.capture_polygon::geography)::bigint, 0) as area_captured_m2,
    case
      when a.user_id <> (select uid from caller) and a.hide_calories then null
      else a.calories
    end as calories,
    a.title,
    a.description,
    a.visibility,
    a.hide_pace,
    a.hide_calories,
    coalesce((select count(*)::int from public.activity_photos ph where ph.activity_id = a.id), 0) as photo_count,
    (select ph.storage_path from public.activity_photos ph
       where ph.activity_id = a.id order by ph.position asc limit 1) as cover_photo_path,
    coalesce((select count(*)::int from public.activity_likes    l where l.activity_id = a.id), 0) as like_count,
    coalesce((select count(*)::int from public.activity_comments c where c.activity_id = a.id), 0) as comment_count,
    exists (
      select 1 from public.activity_likes l
      where l.activity_id = a.id and l.user_id = (select uid from caller)
    ) as has_liked,
    case when a.capture_polygon is null then null
         else st_asgeojson(st_simplifypreservetopology(a.capture_polygon, 0.00002))::jsonb
    end as capture_polygon_geojson,
    case when a.matched_trace is null and a.trace is null then null
         else st_asgeojson(
           coalesce(a.matched_trace, st_simplifypreservetopology(a.trace, 0.00002))
         )::jsonb
    end as trace_geojson
  from public.activities a
  join public.profiles p on p.id = a.user_id
  where a.status = 'processed'
    and (
      a.user_id = (select uid from caller)
      or a.visibility = 'public'
      or (
        a.visibility = 'followers'
        and a.user_id in (
          select followee_id from public.follows
          where follower_id = (select uid from caller)
        )
      )
    )
  order by a.started_at desc
  limit least(p_limit, 50);
$$;

grant execute on function public.friends_feed(int) to authenticated;

-- get_activity_detail: full record for the detail screen, including geometry.

create or replace function public.get_activity_detail(p_activity_id uuid)
returns table (
  activity_id              uuid,
  user_id                  uuid,
  username                 text,
  display_name             text,
  avatar_url               text,
  color                    text,
  type                     public.activity_type,
  started_at               timestamptz,
  ended_at                 timestamptz,
  duration_s               int,
  distance_m               numeric,
  area_captured_m2         bigint,
  calories                 int,
  title                    text,
  description              text,
  visibility               public.activity_visibility,
  hide_pace                boolean,
  hide_calories            boolean,
  capture_polygon_geojson  jsonb,
  trace_geojson            jsonb,
  photo_paths              text[],
  like_count               int,
  comment_count            int,
  has_liked                boolean
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
    a.ended_at,
    a.duration_s,
    a.distance_m,
    coalesce(st_area(a.capture_polygon::geography)::bigint, 0) as area_captured_m2,
    case
      when a.user_id <> auth.uid() and a.hide_calories then null
      else a.calories
    end as calories,
    a.title,
    a.description,
    a.visibility,
    a.hide_pace,
    a.hide_calories,
    case when a.capture_polygon is null then null
         else st_asgeojson(a.capture_polygon)::jsonb end as capture_polygon_geojson,
    st_asgeojson(
      coalesce(a.matched_trace, st_simplifypreservetopology(a.trace, 0.000002))
    )::jsonb as trace_geojson,
    coalesce(
      (select array_agg(ph.storage_path order by ph.position)
         from public.activity_photos ph where ph.activity_id = a.id),
      array[]::text[]
    ) as photo_paths,
    coalesce((select count(*)::int from public.activity_likes    l where l.activity_id = a.id), 0) as like_count,
    coalesce((select count(*)::int from public.activity_comments c where c.activity_id = a.id), 0) as comment_count,
    exists (
      select 1 from public.activity_likes l
      where l.activity_id = a.id and l.user_id = auth.uid()
    ) as has_liked
  from public.activities a
  join public.profiles p on p.id = a.user_id
  where a.id = p_activity_id
    and a.status = 'processed'
    and public.can_read_activity(a.id);
$$;

grant execute on function public.get_activity_detail(uuid) to authenticated;

-- toggle_activity_like: idempotent like/unlike.

create or replace function public.toggle_activity_like(p_activity_id uuid)
returns table (liked boolean, like_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted bool;
  v_count    int;
begin
  if not public.can_read_activity(p_activity_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.activity_likes (activity_id, user_id)
    values (p_activity_id, auth.uid())
    on conflict do nothing;

  if found then
    v_inserted := true;
  else
    delete from public.activity_likes
      where activity_id = p_activity_id and user_id = auth.uid();
    v_inserted := false;
  end if;

  select count(*)::int into v_count from public.activity_likes where activity_id = p_activity_id;
  return query select v_inserted, v_count;
end;
$$;

grant execute on function public.toggle_activity_like(uuid) to authenticated;

-- list_activity_likers: paginated list of users who liked an activity.

create or replace function public.list_activity_likers(
  p_activity_id uuid,
  p_limit       int  default 50,
  p_after       timestamptz default null
)
returns table (
  user_id      uuid,
  username     text,
  display_name text,
  avatar_url   text,
  color        text,
  liked_at     timestamptz,
  is_following boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id          as user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.color,
    l.created_at  as liked_at,
    exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.followee_id = p.id
    ) as is_following
  from public.activity_likes l
  join public.profiles p on p.id = l.user_id
  where l.activity_id = p_activity_id
    and public.can_read_activity(p_activity_id)
    and (p_after is null or l.created_at < p_after)
  order by l.created_at desc
  limit least(p_limit, 100);
$$;

grant execute on function public.list_activity_likers(uuid, int, timestamptz) to authenticated;

-- list_activity_comments: paginated newest-first.

create or replace function public.list_activity_comments(
  p_activity_id uuid,
  p_limit       int  default 50,
  p_after       timestamptz default null
)
returns table (
  comment_id   uuid,
  user_id      uuid,
  username     text,
  display_name text,
  avatar_url   text,
  color        text,
  body         text,
  created_at   timestamptz,
  updated_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id        as comment_id,
    p.id        as user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.color,
    c.body,
    c.created_at,
    c.updated_at
  from public.activity_comments c
  join public.profiles p on p.id = c.user_id
  where c.activity_id = p_activity_id
    and public.can_read_activity(p_activity_id)
    and (p_after is null or c.created_at < p_after)
  order by c.created_at desc
  limit least(p_limit, 100);
$$;

grant execute on function public.list_activity_comments(uuid, int, timestamptz) to authenticated;

-- create_activity_comment: returns the inserted row joined with profile.

create or replace function public.create_activity_comment(
  p_activity_id uuid,
  p_body        text
)
returns table (
  comment_id   uuid,
  user_id      uuid,
  username     text,
  display_name text,
  avatar_url   text,
  color        text,
  body         text,
  created_at   timestamptz,
  updated_at   timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.can_read_activity(p_activity_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(coalesce(p_body, '')) = 0 or char_length(p_body) > 1000 then
    raise exception 'invalid_body' using errcode = '22023';
  end if;

  insert into public.activity_comments (activity_id, user_id, body)
    values (p_activity_id, auth.uid(), p_body)
    returning id into v_id;

  return query
    select
      c.id, p.id, p.username, p.display_name, p.avatar_url, p.color,
      c.body, c.created_at, c.updated_at
    from public.activity_comments c
    join public.profiles p on p.id = c.user_id
    where c.id = v_id;
end;
$$;

grant execute on function public.create_activity_comment(uuid, text) to authenticated;

-- delete_activity_comment: commenter or activity owner. RLS already enforces this
-- on direct delete; this RPC exists so the client has a single named entry point.

create or replace function public.delete_activity_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity uuid;
  v_author   uuid;
begin
  select activity_id, user_id into v_activity, v_author
    from public.activity_comments where id = p_comment_id;
  if v_activity is null then
    raise exception 'not_found' using errcode = '02000';
  end if;
  if v_author <> auth.uid()
     and not exists (select 1 from public.activities a where a.id = v_activity and a.user_id = auth.uid())
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.activity_comments where id = p_comment_id;
end;
$$;

grant execute on function public.delete_activity_comment(uuid) to authenticated;
