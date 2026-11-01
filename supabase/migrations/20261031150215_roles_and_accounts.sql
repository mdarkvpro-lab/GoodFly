-- GoodFly 2.0 — roles and account rules
--
-- owner     : the site owner (one account). Never used from the public website:
--             the local owner console talks to Supabase with the service-role key.
-- direction : the agency bosses (X and Y). Same agency, see every report, manage agent
--             and client accounts, edit only their own direction account.
--             X can never change or deactivate Y, and Y can never change or deactivate X.
-- agent     : agency staff.
-- client    : customers (every self sign-up starts here).
--
-- "Deleting" an account = deactivating it (disabled_at). The owner console purges
-- deactivated accounts after 30 days.

create type public.app_role as enum ('owner', 'direction', 'agent', 'client');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'client',
  disabled_at timestamptz,
  -- set null: deleting the person who suspended someone must not block the deletion
  disabled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one owner can ever exist.
create unique index profiles_single_owner on public.profiles (role) where role = 'owner';

create table public.audit_log (
  id bigint generated always as identity primary key,
  -- set null: the journal entry stays when its author is deleted
  actor uuid references public.profiles (id) on delete set null,
  action text not null,
  target uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;
revoke all on public.profiles, public.audit_log from anon;

-- ───────────── Helpers ─────────────

-- The caller's role, or null when the account is deactivated or unknown.
create function public.my_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid()) and p.disabled_at is null
$$;

revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- Every new auth user gets a client profile. Roles never come from sign-up metadata.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── Read rules ─────────────

create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "direction reads all profiles" on public.profiles
  for select to authenticated
  using ((select public.my_role()) = 'direction');

create policy "agents read client profiles" on public.profiles
  for select to authenticated
  using ((select public.my_role()) = 'agent' and role = 'client');

create policy "direction reads the audit log" on public.audit_log
  for select to authenticated
  using ((select public.my_role()) = 'direction');

-- ───────────── Write rules ─────────────

-- Anyone active edits their own profile (the guard below blocks role and status changes).
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select public.my_role()) is not null)
  with check (id = (select auth.uid()));

-- Direction manages agent and client accounts only — never owner or direction accounts.
create policy "direction updates agents and clients" on public.profiles
  for update to authenticated
  using ((select public.my_role()) = 'direction' and role in ('agent', 'client'))
  with check (role in ('agent', 'client'));

-- No insert or delete policies on purpose: profiles come from the auth trigger and
-- deactivation goes through deactivate_account(). The audit log is written only by
-- the functions below.

-- Column guard for website users (runs as the caller, so the owner console and the
-- security-definer functions below, which do not run as "authenticated", pass through).
create function public.guard_profile_update()
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

create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ───────────── Deactivate / restore (direction) ─────────────

create function public.deactivate_account(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target_role public.app_role;
begin
  if public.my_role() is distinct from 'direction' then
    raise exception 'only direction accounts can deactivate accounts' using errcode = '42501';
  end if;

  select p.role into target_role
  from public.profiles p
  where p.id = target and p.disabled_at is null
  for update;

  if not found then
    raise exception 'account not found or already deactivated' using errcode = 'P0002';
  end if;

  if target_role not in ('agent', 'client') then
    raise exception 'owner and direction accounts can only be changed from the owner console' using errcode = '42501';
  end if;

  update public.profiles
  set disabled_at = now(), disabled_by = caller
  where id = target;

  insert into public.audit_log (actor, action, target)
  values (caller, 'deactivate_account', target);
end;
$$;

create function public.restore_account(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target_role public.app_role;
  disabled timestamptz;
begin
  if public.my_role() is distinct from 'direction' then
    raise exception 'only direction accounts can restore accounts' using errcode = '42501';
  end if;

  select p.role, p.disabled_at into target_role, disabled
  from public.profiles p
  where p.id = target
  for update;

  if disabled is null then
    raise exception 'account not found or not deactivated' using errcode = 'P0002';
  end if;

  if target_role not in ('agent', 'client') then
    raise exception 'owner and direction accounts can only be changed from the owner console' using errcode = '42501';
  end if;

  if disabled < now() - interval '30 days' then
    raise exception 'the 30-day restore window has passed' using errcode = '42501';
  end if;

  update public.profiles
  set disabled_at = null, disabled_by = null
  where id = target;

  insert into public.audit_log (actor, action, target)
  values (caller, 'restore_account', target);
end;
$$;

revoke all on function public.deactivate_account(uuid) from public, anon;
revoke all on function public.restore_account(uuid) from public, anon;
grant execute on function public.deactivate_account(uuid) to authenticated;
grant execute on function public.restore_account(uuid) to authenticated;
