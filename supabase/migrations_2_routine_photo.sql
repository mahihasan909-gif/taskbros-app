-- Adds routine-photo upload + AI extraction support.
-- Run in Supabase SQL editor after schema.sql.

alter table profiles add column routine_photo_url text;
alter table profiles add column routine_scan_status text not null default 'none'
  check (routine_scan_status in ('none', 'processing', 'done', 'failed'));

-- Storage bucket for routine photos (private; accessed via signed URLs)
insert into storage.buckets (id, name, public)
values ('routine-photos', 'routine-photos', false)
on conflict (id) do nothing;

create policy "users manage their own routine photo"
  on storage.objects for all
  using (bucket_id = 'routine-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'routine-photos' and (storage.foldername(name))[1] = auth.uid()::text);
