-- Extensions
-- postgis: spatial types and functions (available on all Supabase instances)
-- h3 is not available as a Postgres extension on this instance; H3 cell
-- computation is handled in the Edge Function using h3-js instead.
create extension if not exists postgis;

-- profiles ------------------------------------------------------------------

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null,
  display_name    text not null,
  avatar_url      text,
  color           text not null default '#7F77DD',
  city            text,
  home_geom       geometry(Point, 4326),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_username_idx on public.profiles(username);

alter table public.profiles enable row level security;

create policy "profiles_read_all" on public.profiles
  for select using (true);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    split_part(new.email, '@', 1) || '_' || substring(md5(random()::text), 1, 4),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
