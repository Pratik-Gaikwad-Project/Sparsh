-- Run after the existing Lovenest migrations. Creates private storage for real voice recordings.
alter table public.messages add column if not exists voice_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-audio', 'chat-audio', false, 20971520, array['audio/mp4', 'audio/m4a', 'audio/aac'])
on conflict (id) do update set public = false, file_size_limit = 20971520,
  allowed_mime_types = array['audio/mp4', 'audio/m4a', 'audio/aac'];

drop policy if exists "chat audio owner upload" on storage.objects;
create policy "chat audio owner upload" on storage.objects for insert to authenticated
with check (bucket_id = 'chat-audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "chat audio participants read" on storage.objects;
create policy "chat audio participants read" on storage.objects for select to authenticated
using (
  bucket_id = 'chat-audio' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.partner_id::text = (storage.foldername(name))[1]
    )
  )
);

drop policy if exists "chat audio owner delete" on storage.objects;
create policy "chat audio owner delete" on storage.objects for delete to authenticated
using (bucket_id = 'chat-audio' and (storage.foldername(name))[1] = auth.uid()::text);
