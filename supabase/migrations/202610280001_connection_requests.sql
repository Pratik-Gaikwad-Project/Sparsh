-- Lovenest connection request flow. Apply after the existing schema.sql.
-- Clients cannot directly insert/update requests or directly set profiles.partner_id.

create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connection_requests_not_self check (sender_id <> receiver_id)
);

create index if not exists connection_requests_receiver_status_idx
  on public.connection_requests (receiver_id, status, created_at desc);
create index if not exists connection_requests_sender_status_idx
  on public.connection_requests (sender_id, status, created_at desc);
-- Only one pending request per pair, regardless of which person sent it.
create unique index if not exists connection_requests_one_pending_pair_idx
  on public.connection_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
  where status = 'pending';

create or replace function public.touch_connection_request_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists connection_requests_touch_updated_at on public.connection_requests;
create trigger connection_requests_touch_updated_at before update on public.connection_requests
for each row execute function public.touch_connection_request_updated_at();

alter table public.connection_requests enable row level security;
drop policy if exists "participants can read connection requests" on public.connection_requests;
create policy "participants can read connection requests" on public.connection_requests
  for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());
revoke all on public.connection_requests from anon, authenticated;
grant select on public.connection_requests to authenticated;

-- Remove the old immediate-pairing entry point so a mobile client cannot bypass consent.
revoke all on function public.pair_with_code(text) from public, anon, authenticated;

create or replace function public.send_connection_request(code text)
returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  caller uuid := auth.uid();
  target uuid;
  request_id uuid;
begin
  if caller is null then raise exception 'You must be signed in'; end if;
  if code is null or length(trim(code)) = 0 then raise exception 'Enter a connection code'; end if;
  select p.id into target from public.profiles p
    where p.invite_code = upper(trim(code)) limit 1;
  if target is null then raise exception 'Invalid connection code'; end if;
  if target = caller then raise exception 'You cannot send a request to yourself'; end if;
  if exists (select 1 from public.profiles where id in (caller, target) and partner_id is not null) then
    raise exception 'One of you is already connected';
  end if;
  if exists (select 1 from public.connection_requests r
    where r.status = 'pending'
      and ((r.sender_id = caller and r.receiver_id = target)
        or (r.sender_id = target and r.receiver_id = caller))) then
    raise exception 'A pending request already exists between you';
  end if;
  insert into public.connection_requests(sender_id, receiver_id, status)
    values (caller, target, 'pending') returning id into request_id;
  return request_id;
exception when unique_violation then
  raise exception 'A pending request already exists between you';
end $$;

-- Only returns limited, approved profile fields for requests involving the caller.
create or replace function public.list_connection_requests()
returns table (
  id uuid, sender_id uuid, sender_name text, sender_hue integer,
  receiver_id uuid, receiver_name text, receiver_hue integer,
  status text, created_at timestamptz, direction text
)
language sql stable security definer set search_path = public, auth as $$
  select r.id, r.sender_id, s.name, s.hue, r.receiver_id, p.name, p.hue,
         r.status, r.created_at,
         case when r.receiver_id = auth.uid() then 'incoming' else 'outgoing' end
  from public.connection_requests r
  join public.profiles s on s.id = r.sender_id
  join public.profiles p on p.id = r.receiver_id
  where auth.uid() is not null and (r.sender_id = auth.uid() or r.receiver_id = auth.uid())
  order by r.created_at desc
$$;

create or replace function public.accept_connection_request(request_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare r public.connection_requests%rowtype; caller uuid := auth.uid();
begin
  if caller is null then raise exception 'You must be signed in'; end if;
  select * into r from public.connection_requests where id = request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.receiver_id <> caller then raise exception 'Only the recipient can accept this request'; end if;
  if r.status <> 'pending' then raise exception 'This request is no longer pending'; end if;
  -- Lock both profiles in deterministic order to prevent conflicting accepts.
  perform 1 from public.profiles where id in (r.sender_id, r.receiver_id) order by id for update;
  if exists (select 1 from public.profiles where id in (r.sender_id, r.receiver_id) and partner_id is not null) then
    raise exception 'One of you is already connected';
  end if;
  update public.profiles set partner_id = r.receiver_id where id = r.sender_id;
  update public.profiles set partner_id = r.sender_id where id = r.receiver_id;
  update public.connection_requests set status = 'accepted' where id = r.id;
  -- Any competing pending requests involving either newly connected user are closed.
  update public.connection_requests set status = 'rejected'
    where status = 'pending' and id <> r.id
      and (sender_id in (r.sender_id, r.receiver_id) or receiver_id in (r.sender_id, r.receiver_id));
end $$;

create or replace function public.reject_connection_request(request_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'You must be signed in'; end if;
  update public.connection_requests set status = 'rejected'
    where id = request_id and receiver_id = caller and status = 'pending';
  if not found then raise exception 'Request not found, already handled, or you are not the recipient'; end if;
end $$;

create or replace function public.cancel_connection_request(request_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'You must be signed in'; end if;
  update public.connection_requests set status = 'cancelled'
    where id = request_id and sender_id = caller and status = 'pending';
  if not found then raise exception 'Request not found, already handled, or you are not the sender'; end if;
end $$;

revoke all on function public.send_connection_request(text) from public, anon;
revoke all on function public.list_connection_requests() from public, anon;
revoke all on function public.accept_connection_request(uuid) from public, anon;
revoke all on function public.reject_connection_request(uuid) from public, anon;
revoke all on function public.cancel_connection_request(uuid) from public, anon;
grant execute on function public.send_connection_request(text) to authenticated;
grant execute on function public.list_connection_requests() to authenticated;
grant execute on function public.accept_connection_request(uuid) to authenticated;
grant execute on function public.reject_connection_request(uuid) to authenticated;
grant execute on function public.cancel_connection_request(uuid) to authenticated;

-- Realtime publication may already contain this table; handle that safely.
do $$ begin
  alter publication supabase_realtime add table public.connection_requests;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
