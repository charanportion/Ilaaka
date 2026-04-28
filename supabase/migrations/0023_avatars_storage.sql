-- Phase 6: profile editing — avatars storage bucket.
-- Users upload to avatars/<user_id>/<filename>. RLS keeps writes per-user;
-- reads are public so the URL can render in friend lists / public profiles.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,                                          -- public reads
  2 * 1024 * 1024,                               -- 2 MB max per file
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
   set public             = excluded.public,
       file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- Drop any prior versions so this migration is re-runnable.
drop policy if exists "avatars_read_all"     on storage.objects;
drop policy if exists "avatars_insert_own"   on storage.objects;
drop policy if exists "avatars_update_own"   on storage.objects;
drop policy if exists "avatars_delete_own"   on storage.objects;

-- Public read.
create policy "avatars_read_all" on storage.objects
  for select
  using (bucket_id = 'avatars');

-- Authenticated users can upload to a folder named with their own user_id.
-- Path structure: avatars/<user_id>/<filename>
create policy "avatars_insert_own" on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_update_own" on storage.objects
  for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_delete_own" on storage.objects
  for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
