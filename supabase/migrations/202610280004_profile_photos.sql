-- Lovenest profile photos: private storage, per-user ownership, paired-user read access.
-- Apply after the existing connection-request migrations.

alter table public.profiles add column if not exists avatar_path text;
grant update (avatar_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- A user can upload/update/remove only objects inside their own UUID folder.
drop policy if exists "profile photos owner insert" on storage.objects;
create policy "profile photos owner insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile photos owner update" on storage.objects;
create policy "profile photos owner update" on storage.objects
for update to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile photos owner delete" on storage.objects;
create policy "profile photos owner delete" on storage.objects
for delete to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Only the owner and their currently connected partner can read a profile photo.
drop policy if exists "profile photos owner or partner read" on storage.objects;
create policy "profile photos owner or partner read" on storage.objects
for select to authenticated
using (
  bucket_id = 'profile-photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles viewer
      join public.profiles owner on owner.id::text = (storage.foldername(storage.objects.name))[1]
      where viewer.id = auth.uid() and viewer.partner_id = owner.id
    )
    or exists (
      select 1 from public.profiles owner
      join public.connection_requests cr on cr.sender_id = owner.id or cr.receiver_id = owner.id
      where owner.id::text = (storage.foldername(storage.objects.name))[1]
        and cr.status = 'pending'
        and (cr.sender_id = auth.uid() or cr.receiver_id = auth.uid())
    )
  )
);

-- Include photo paths in the safe RPC response for connection-request cards.
drop function if exists public.list_connection_requests();
create function public.list_connection_requests()
returns table (
  id uuid, sender_id uuid, sender_name text, sender_hue integer, sender_avatar_path text,
  receiver_id uuid, receiver_name text, receiver_hue integer, receiver_avatar_path text,
  status text, created_at timestamptz, direction text
)
language sql stable security definer set search_path = public, auth as $$
  select r.id, r.sender_id, s.name, s.hue, s.avatar_path,
         r.receiver_id, p.name, p.hue, p.avatar_path,
         r.status,
         r.created_at,
         case when r.receiver_id = auth.uid() then 'incoming' else 'outgoing' end
  from public.connection_requests r
  join public.profiles s on s.id = r.sender_id
  join public.profiles p on p.id = r.receiver_id
  where auth.uid() is not null and (r.sender_id = auth.uid() or r.receiver_id = auth.uid())
  order by r.created_at desc
$$;
revoke all on function public.list_connection_requests() from public, anon;
grant execute on function public.list_connection_requests() to authenticated;
