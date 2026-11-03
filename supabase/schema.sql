-- Lovenest database schema for Supabase (Postgres).
-- Paste this whole file into Supabase > SQL Editor and press Run.

-- ============ profiles ============
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  name           text not null default 'Me',
  hue            int  not null default 345,
  invite_code    text not null unique default upper(substr(md5(random()::text), 1, 6)),
  partner_id     uuid references public.profiles(id) on delete set null,
  together_since date,
  created_at     timestamptz not null default now()
);

-- Helper that reads my partner without triggering recursive row security.
create function public.my_partner_id() returns uuid
language sql security definer stable set search_path = public as $$
  select partner_id from public.profiles where id = auth.uid()
$$;

alter table public.profiles enable row level security;

create policy "read me and my partner" on public.profiles
  for select to authenticated
  using (id = auth.uid() or id = public.my_partner_id());

create policy "update only me" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Users may change only these columns. partner_id can only change through pair_with_code().
revoke update on public.profiles from authenticated;
grant update (name, hue, together_since) on public.profiles to authenticated;

-- Create a profile automatically when someone signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ts date;
begin
  begin
    ts := nullif(new.raw_user_meta_data->>'together_since', '')::date;
  exception when others then
    ts := null;
  end;
  insert into public.profiles (id, name, hue, together_since)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'name', ''), 'Me'),
          floor(random() * 360)::int,
          ts);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Pair two accounts using the invite code shown in the app.
create function public.pair_with_code(code text) returns void
language plpgsql security definer set search_path = public as $$
declare other uuid;
begin
  select id into other from public.profiles where invite_code = upper(trim(code));
  if other is null then raise exception 'Invite code not found'; end if;
  if other = auth.uid() then raise exception 'That is your own code'; end if;
  if exists (select 1 from public.profiles
             where id in (other, auth.uid()) and partner_id is not null) then
    raise exception 'One of you is already paired';
  end if;
  update public.profiles set partner_id = other     where id = auth.uid();
  update public.profiles set partner_id = auth.uid() where id = other;
end $$;

revoke all on function public.pair_with_code(text) from public, anon;
grant execute on function public.pair_with_code(text) to authenticated;

-- ============ messages ============
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body        text,
  voice_secs  int,
  status      text not null default 'sent' check (status in ('sent', 'delivered', 'read')),
  reaction    text,
  created_at  timestamptz not null default now(),
  check (body is not null or voice_secs is not null)
);

create index messages_pair_idx on public.messages (sender_id, receiver_id, created_at);
create index messages_receiver_idx on public.messages (receiver_id, status);

alter table public.messages enable row level security;

create policy "read my messages" on public.messages
  for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

-- You can only send to your own partner, as yourself.
create policy "send to my partner" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and receiver_id = public.my_partner_id());

create policy "update my messages" on public.messages
  for update to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid())
  with check (sender_id = auth.uid() or receiver_id = auth.uid());

-- Only the read tick and the heart reaction can change after sending.
revoke update on public.messages from authenticated;
grant update (status, reaction) on public.messages to authenticated;

-- Live updates for the app.
alter publication supabase_realtime add table public.messages;
