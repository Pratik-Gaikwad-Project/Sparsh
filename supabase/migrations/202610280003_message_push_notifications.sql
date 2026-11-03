-- Push token storage for Expo notifications. Apply after the existing Lovenest migrations.
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;

-- A user may only manage their own device tokens. The edge function uses the
-- server-only service-role key to look up the recipient's token.
drop policy if exists "users manage own push tokens" on public.push_tokens;
create policy "users manage own push tokens" on public.push_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.push_tokens from anon;
grant select, insert, update, delete on public.push_tokens to authenticated;
