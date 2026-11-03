-- Lovenest: permanently delete the chat history when either partner disconnects.
-- Apply after 202610280001_connection_requests.sql.
-- All changes to message rows and both profiles happen in one PostgreSQL transaction.

create or replace function public.disconnect_partner()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller uuid := auth.uid();
  other uuid;
begin
  if caller is null then
    raise exception 'You must be signed in';
  end if;

  -- Lock the caller profile and discover the current partner.
  select p.partner_id into other
  from public.profiles p
  where p.id = caller
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if other is null then
    raise exception 'You are not currently connected';
  end if;

  -- Lock both profiles in deterministic order to avoid concurrent disconnect races.
  perform 1
  from public.profiles
  where id in (caller, other)
  order by id
  for update;

  -- Re-check the mutual connection after obtaining locks.
  if not exists (
    select 1 from public.profiles
    where id = caller and partner_id = other
  ) or not exists (
    select 1 from public.profiles
    where id = other and partner_id = caller
  ) then
    raise exception 'Connection has already changed; refresh and try again';
  end if;

  -- Permanently remove every text, voice, and photo message row for this pair.
  delete from public.messages
  where (sender_id = caller and receiver_id = other)
     or (sender_id = other and receiver_id = caller);

  -- Remove the connection from both profiles.
  update public.profiles set partner_id = null where id in (caller, other);

  -- Close any remaining pending requests involving either account.
  update public.connection_requests
  set status = 'cancelled'
  where status = 'pending'
    and (sender_id in (caller, other) or receiver_id in (caller, other));
end;
$$;

revoke all on function public.disconnect_partner() from public, anon;
grant execute on function public.disconnect_partner() to authenticated;
