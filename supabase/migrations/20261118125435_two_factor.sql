-- Two-factor authentication (2FA) for every staff account.
--
-- 1. The database itself refuses staff rights to a session that did not pass 2FA:
--    my_role() and has_permission() — used by every staff rule — now need an "aal2" token
--    (password + 6-digit code) issued after the account's last security reset.
-- 2. Backup codes: 10 single-use codes per account, stored only as hashes.
-- 3. Reset (lost phone): only the server (owner CLI, recovery Edge Function) can wipe 2FA,
--    and a reset cuts every open session of the account.

-- ───── Session check ─────
alter table public.profiles add column security_epoch timestamptz not null default to_timestamp(0);
comment on column public.profiles.security_epoch is 'Tokens issued before this moment are refused (2FA reset, recovery).';

-- True when the caller's token passed 2FA and was issued after the account's last reset.
create function private.strong_session(epoch timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and coalesce(((select auth.jwt() ->> 'iat'))::bigint, 0) >= floor(extract(epoch from epoch))::bigint
$$;
revoke all on function private.strong_session(timestamptz) from public, anon, authenticated;

create or replace function public.my_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid()) and p.disabled_at is null and private.strong_session(p.security_epoch)
$$;

create or replace function public.has_permission(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select pr.role = 'direction' or (pr.role = 'agent' and p = any (pr.permissions))
     from public.profiles pr
     where pr.id = (select auth.uid()) and pr.disabled_at is null and private.strong_session(pr.security_epoch)),
    false)
$$;

-- Signed-in users can never move their own security epoch.
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

  if new.security_epoch is distinct from old.security_epoch then
    raise exception 'sessions are reset by the server only' using errcode = '42501';
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

-- ───── Backup codes ─────
create table private.mfa_backup_codes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on private.mfa_backup_codes (user_id);
alter table private.mfa_backup_codes enable row level security;

create table private.mfa_recovery_failures (
  user_id uuid not null references auth.users (id) on delete cascade,
  failed_at timestamptz not null default now()
);
create index on private.mfa_recovery_failures (user_id, failed_at);
alter table private.mfa_recovery_failures enable row level security;

-- The signed-in staff member (after 2FA) replaces their 10 codes. The site computes the hashes;
-- the codes themselves never reach the database.
create function public.set_backup_codes(hashes text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  epoch timestamptz;
begin
  select p.security_epoch into epoch from public.profiles p
  where p.id = uid and p.role in ('direction', 'agent') and p.disabled_at is null;
  if uid is null or epoch is null or not private.strong_session(epoch) then
    raise exception 'two-factor session required' using errcode = '42501';
  end if;
  if coalesce(array_length(hashes, 1), 0) <> 10
     or exists (select 1 from unnest(hashes) h where h !~ '^[0-9a-f]{64}$')
     or (select count(distinct h) from unnest(hashes) h) <> 10 then
    raise exception 'invalid' using errcode = '22023';
  end if;
  delete from private.mfa_backup_codes where user_id = uid;
  insert into private.mfa_backup_codes (user_id, code_hash) select uid, h from unnest(hashes) h;
  insert into public.audit_log (actor, action, target, details) values (uid, 'mfa_backup_codes_created', uid, '{}'::jsonb);
end;
$$;
revoke all on function public.set_backup_codes(text[]) from public, anon;
grant execute on function public.set_backup_codes(text[]) to authenticated;

-- How many unused codes the signed-in account has left (shown on "Mon compte").
create function public.backup_codes_left()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from private.mfa_backup_codes c
  where c.user_id = (select auth.uid()) and c.used_at is null
$$;
revoke all on function public.backup_codes_left() from public, anon;
grant execute on function public.backup_codes_left() to authenticated;

-- Server only (recovery Edge Function): spends one backup code. 5 wrong codes per hour at most.
create function public.consume_backup_code(account uuid, code_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  hit bigint;
begin
  if (select count(*) from private.mfa_recovery_failures f
      where f.user_id = account and f.failed_at > now() - interval '1 hour') >= 5 then
    raise exception 'too_many' using errcode = '54000';
  end if;
  update private.mfa_backup_codes c set used_at = now()
  where c.id = (select c2.id from private.mfa_backup_codes c2
                where c2.user_id = account and c2.code_hash = lower(consume_backup_code.code_hash) and c2.used_at is null
                limit 1)
  returning c.id into hit;
  if hit is null then
    insert into private.mfa_recovery_failures (user_id) values (account);
    delete from private.mfa_recovery_failures f where f.failed_at < now() - interval '2 days';
    return false;
  end if;
  return true;
end;
$$;
revoke all on function public.consume_backup_code(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_backup_code(uuid, text) to service_role;

-- Server only: after the 2FA factors were deleted (Auth admin API), forget the backup codes,
-- refuse every token issued before now and end every open session — except `keep_session`
-- (the session that is re-enrolling right now, for a backup-code recovery).
create function public.mfa_reset(account uuid, via text, keep_session uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if via not in ('owner_cli', 'backup_code') then
    raise exception 'invalid' using errcode = '22023';
  end if;
  delete from private.mfa_backup_codes where user_id = account;
  update public.profiles set security_epoch = now() where id = account;
  delete from auth.sessions s where s.user_id = account and (keep_session is null or s.id <> keep_session);
  insert into public.audit_log (actor, action, target, details)
  values (case when via = 'backup_code' then account end, 'mfa_reset', account, jsonb_build_object('via', via));
end;
$$;
revoke all on function public.mfa_reset(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.mfa_reset(uuid, text, uuid) to service_role;
