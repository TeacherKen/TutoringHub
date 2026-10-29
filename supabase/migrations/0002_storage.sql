-- TutoringHub — private file storage for worksheets (PDF) and photos of work.
-- Run after 0001_init.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials',
  'materials',
  false,
  15728640, -- 15 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
)
on conflict (id) do nothing;

-- Only the tutor can upload, read or delete files in this bucket.
-- Files are opened with short-lived signed links made on the server.
create policy materials_tutor_select on storage.objects
  for select to authenticated
  using (bucket_id = 'materials' and public.is_tutor());

create policy materials_tutor_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materials' and public.is_tutor());

create policy materials_tutor_update on storage.objects
  for update to authenticated
  using (bucket_id = 'materials' and public.is_tutor())
  with check (bucket_id = 'materials' and public.is_tutor());

create policy materials_tutor_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'materials' and public.is_tutor());
