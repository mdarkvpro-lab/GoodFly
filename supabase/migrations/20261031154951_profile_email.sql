-- Direction needs to see account e-mails, but auth.users is not exposed to the API.
-- Keep a copy of the e-mail on the profile, maintained by triggers (never written by users).

alter table public.profiles add column email text not null default '';

update public.profiles p
set email = coalesce(u.email, '')
from auth.users u
where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.email, ''));
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- E-mail changes in Supabase Auth flow to the profile.
create function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

revoke all on function public.sync_profile_email() from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

-- Website users can never edit the copied e-mail themselves.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    new.updated_at := now();
    return new;
  end if;

  if new.id <> old.id or new.created_at <> old.created_at then
    raise exception 'id and created_at cannot change' using errcode = '42501';
  end if;

  if new.email is distinct from old.email then
    raise exception 'the e-mail is managed by Supabase Auth' using errcode = '42501';
  end if;

  if new.role is distinct from old.role then
    if old.role in ('owner', 'direction') or new.role in ('owner', 'direction') then
      raise exception 'only the owner can grant or remove owner and direction roles' using errcode = '42501';
    end if;
    if public.my_role() is distinct from 'direction' then
      raise exception 'only direction accounts can change roles' using errcode = '42501';
    end if;
  end if;

  if new.disabled_at is distinct from old.disabled_at or new.disabled_by is distinct from old.disabled_by then
    raise exception 'use deactivate_account() or restore_account()' using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;
