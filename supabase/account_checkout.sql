begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_payment_method_id text not null unique,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.travel_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'pending', 'paid', 'booked', 'cancelled', 'refunded')),
  destination text,
  starts_on date,
  ends_on date,
  currency text default 'USD',
  subtotal_amount numeric(12,2),
  service_fee_amount numeric(12,2),
  total_amount numeric(12,2),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.travel_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.travel_orders(id) on delete cascade,
  item_type text not null check (item_type in ('flight', 'hotel', 'car', 'fee', 'insurance', 'other')),
  supplier text,
  title text not null,
  description text,
  quantity integer not null default 1,
  unit_amount numeric(12,2),
  total_amount numeric(12,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_methods_user_id_idx on public.payment_methods(user_id);
create index if not exists travel_orders_user_id_idx on public.travel_orders(user_id);
create index if not exists travel_order_items_order_id_idx on public.travel_order_items(order_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists stripe_customers_set_updated_at on public.stripe_customers;
create trigger stripe_customers_set_updated_at
before update on public.stripe_customers
for each row
execute function public.set_updated_at();

drop trigger if exists payment_methods_set_updated_at on public.payment_methods;
create trigger payment_methods_set_updated_at
before update on public.payment_methods
for each row
execute function public.set_updated_at();

drop trigger if exists travel_orders_set_updated_at on public.travel_orders;
create trigger travel_orders_set_updated_at
before update on public.travel_orders
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.payment_methods enable row level security;
alter table public.travel_orders enable row level security;
alter table public.travel_order_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own on public.profiles
      for select to authenticated
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own on public.profiles
      for update to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'payment_methods' and policyname = 'payment_methods_select_own'
  ) then
    create policy payment_methods_select_own on public.payment_methods
      for select to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'travel_orders' and policyname = 'travel_orders_select_own'
  ) then
    create policy travel_orders_select_own on public.travel_orders
      for select to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'travel_order_items' and policyname = 'travel_order_items_select_own'
  ) then
    create policy travel_order_items_select_own on public.travel_order_items
      for select to authenticated
      using (
        exists (
          select 1
          from public.travel_orders o
          where o.id = order_id and o.user_id = auth.uid()
        )
      );
  end if;
end
$$;

commit;
