-- "Choose a new password" after a temporary one.
-- The flag used to live in the user's own metadata, which the user can edit with the public key,
-- so an employee could skip the forced change. It now lives in profiles: only the server
-- (owner console, Edge Functions) sets it, and the database clears it when the password changes.

alter table public.profiles add column must_change_password boolean not null default false;

-- Accounts that still have a temporary password keep the obligation.
update public.profiles p
set must_change_password = true
from auth.users u
where u.id = p.id and (u.raw_user_meta_data ->> 'must_change_password') = 'true';

-- Signed-in users can never change the flag themselves.
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

  if new.permissions is distinct from old.permissions then
    raise exception 'use set_employee_permissions()' using errcode = '42501';
  end if;

  if new.must_change_password is distinct from old.must_change_password then
    raise exception 'the temporary password flag is cleared by changing the password' using errcode = '42501';
  end if;

  if new.role is distinct from old.role then
    if old.role in ('owner', 'direction') or new.role in ('owner', 'direction') then
      raise exception 'only the owner can grant or remove owner and direction roles' using errcode = '42501';
    end if;
    if old.role = 'agent' then
      raise exception 'an employee is removed through a removal request approved by the other Direction account' using errcode = '42501';
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

-- A new password (set by the user or by an admin) clears the flag. The server sets it again
-- right after giving a temporary password.
create function public.clear_must_change_password()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set must_change_password = false where id = new.id and must_change_password;
  return new;
end;
$$;
revoke execute on function public.clear_must_change_password() from public, anon, authenticated;

create trigger on_auth_user_password_changed
  after update of encrypted_password on auth.users
  for each row
  when (new.encrypted_password is distinct from old.encrypted_password)
  execute function public.clear_must_change_password();

-- The old copy in the user metadata is no longer read.
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'must_change_password'
where raw_user_meta_data ? 'must_change_password';
