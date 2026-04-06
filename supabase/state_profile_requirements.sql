begin;

alter table public.profiles
  add column if not exists state_of_practice text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, state_of_practice)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    upper(nullif(new.raw_user_meta_data ->> 'state_of_practice', ''))
  )
  on conflict (id) do update
    set
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      state_of_practice = coalesce(excluded.state_of_practice, public.profiles.state_of_practice),
      updated_at = now();

  return new;
end;
$$;

commit;
