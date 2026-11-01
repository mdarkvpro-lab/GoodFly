-- Public bucket for programme photos. Anyone can view; only staff with "programs.manage" can
-- upload, replace or delete, and only JPEG/PNG/WebP up to 5 MB under programs/.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('program-images', 'program-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "staff upload programme images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'program-images'
    and (storage.foldername(name))[1] = 'programs'
    and (select public.has_permission('programs.manage'))
  );

create policy "staff replace programme images" on storage.objects
  for update to authenticated
  using (bucket_id = 'program-images' and (select public.has_permission('programs.manage')))
  with check (bucket_id = 'program-images' and (storage.foldername(name))[1] = 'programs');

create policy "staff delete programme images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'program-images' and (select public.has_permission('programs.manage')));
