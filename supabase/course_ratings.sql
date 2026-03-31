begin;

create extension if not exists pgcrypto;

create table if not exists public.course_ratings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  overall_rating integer not null check (overall_rating between 1 and 5),
  content_rating integer check (content_rating between 1 and 5),
  instructor_rating integer check (instructor_rating between 1 and 5),
  logistics_rating integer check (logistics_rating between 1 and 5),
  value_rating integer check (value_rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);

create index if not exists course_ratings_course_id_idx on public.course_ratings(course_id);
create index if not exists course_ratings_user_id_idx on public.course_ratings(user_id);

create or replace function public.set_course_ratings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists course_ratings_set_updated_at on public.course_ratings;
create trigger course_ratings_set_updated_at
before update on public.course_ratings
for each row
execute function public.set_course_ratings_updated_at();

create or replace view public.course_rating_summary as
select
  course_id,
  round(avg(overall_rating)::numeric, 2) as average_overall_rating,
  count(*)::integer as rating_count,
  round(avg(content_rating)::numeric, 2) as average_content_rating,
  round(avg(instructor_rating)::numeric, 2) as average_instructor_rating,
  round(avg(logistics_rating)::numeric, 2) as average_logistics_rating,
  round(avg(value_rating)::numeric, 2) as average_value_rating
from public.course_ratings
group by course_id;

alter table public.course_ratings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'course_ratings' and policyname = 'course_ratings_select_public'
  ) then
    create policy course_ratings_select_public on public.course_ratings
      for select to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'course_ratings' and policyname = 'course_ratings_insert_own'
  ) then
    create policy course_ratings_insert_own on public.course_ratings
      for insert to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'course_ratings' and policyname = 'course_ratings_update_own'
  ) then
    create policy course_ratings_update_own on public.course_ratings
      for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

commit;
