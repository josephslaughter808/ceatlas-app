begin;

create extension if not exists pgcrypto;

create table if not exists public.linked_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_key text not null,
  provider_name text not null,
  login_label text,
  username_hint text,
  encrypted_username text not null,
  encrypted_secret text not null,
  status text not null default 'connected' check (status in ('connected', 'needs_reauth', 'sync_pending', 'sync_error')),
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider_key)
);

create index if not exists linked_provider_accounts_user_id_idx on public.linked_provider_accounts(user_id);
create index if not exists linked_provider_accounts_provider_key_idx on public.linked_provider_accounts(provider_key);

drop trigger if exists linked_provider_accounts_set_updated_at on public.linked_provider_accounts;
create trigger linked_provider_accounts_set_updated_at
before update on public.linked_provider_accounts
for each row
execute function public.set_updated_at();

alter table public.linked_provider_accounts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'linked_provider_accounts' and policyname = 'linked_provider_accounts_select_own'
  ) then
    create policy linked_provider_accounts_select_own on public.linked_provider_accounts
      for select to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'linked_provider_accounts' and policyname = 'linked_provider_accounts_insert_own'
  ) then
    create policy linked_provider_accounts_insert_own on public.linked_provider_accounts
      for insert to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'linked_provider_accounts' and policyname = 'linked_provider_accounts_update_own'
  ) then
    create policy linked_provider_accounts_update_own on public.linked_provider_accounts
      for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'linked_provider_accounts' and policyname = 'linked_provider_accounts_delete_own'
  ) then
    create policy linked_provider_accounts_delete_own on public.linked_provider_accounts
      for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

commit;

