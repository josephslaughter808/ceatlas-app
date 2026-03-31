alter table public.pending_courses
  add column if not exists source_key text,
  add column if not exists provider_slug text,
  add column if not exists source_url text,
  add column if not exists course_type text,
  add column if not exists audience text,
  add column if not exists topic text,
  add column if not exists credits_text text,
  add column if not exists price_amount double precision,
  add column if not exists currency text,
  add column if not exists date_text text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text,
  add column if not exists instructors text,
  add column if not exists accreditation text,
  add column if not exists registration_deadline text,
  add column if not exists requirements text,
  add column if not exists tags jsonb,
  add column if not exists metadata jsonb,
  add column if not exists updated_at timestamptz default now();

create unique index if not exists pending_courses_source_key_idx
  on public.pending_courses (source_key)
  where source_key is not null;

create or replace function public.set_pending_courses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pending_courses_set_updated_at on public.pending_courses;

create trigger pending_courses_set_updated_at
before update on public.pending_courses
for each row
execute function public.set_pending_courses_updated_at();

alter table public.pending_courses enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pending_courses'
      and policyname = 'pending_courses_public_read'
  ) then
    create policy pending_courses_public_read
      on public.pending_courses
      for select
      to anon, authenticated
      using (true);
  end if;
end
$$;
