-- GoodFly — employees (agents) with permissions, two-boss approval for removing an employee,
-- and the agency's travel programmes.

-- ───────────── 1. Employee permissions ─────────────
-- Direction accounts implicitly have every permission. Agents only have what Direction grants.
alter table public.profiles
  add column permissions text[] not null default '{}'
  check (permissions <@ array['programs.manage', 'clients.view', 'reports.view', 'bookings.manage']::text[]);

create function public.has_permission(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select pr.role = 'direction' or (pr.role = 'agent' and p = any (pr.permissions))
     from public.profiles pr
     where pr.id = (select auth.uid()) and pr.disabled_at is null),
    false)
$$;

revoke all on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated;

-- Agents see client profiles only with the "clients.view" permission.
drop policy "read profiles" on public.profiles;
create policy "read profiles" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.my_role()) = 'direction'
    or (role = 'client' and (select public.has_permission('clients.view')))
  );

-- Website users may not change permissions directly, nor demote an employee
-- (an employee leaves through an approved removal request).
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

create function public.set_employee_permissions(employee uuid, perms text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role public.app_role;
  clean text[];
begin
  if public.my_role() is distinct from 'direction' then
    raise exception 'only direction accounts can change permissions' using errcode = '42501';
  end if;
  select p.role into target_role from public.profiles p where p.id = employee and p.disabled_at is null;
  if target_role is distinct from 'agent' then
    raise exception 'permissions apply to active employees only' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct x order by x), '{}') into clean from unnest(coalesce(perms, '{}')) as x;
  if not clean <@ array['programs.manage', 'clients.view', 'reports.view', 'bookings.manage']::text[] then
    raise exception 'unknown permission' using errcode = '22023';
  end if;
  update public.profiles set permissions = clean where id = employee;
  insert into public.audit_log (actor, action, target, details)
  values ((select auth.uid()), 'set_employee_permissions', employee, jsonb_build_object('permissions', clean));
end;
$$;

revoke all on function public.set_employee_permissions(uuid, text[]) from public, anon;
grant execute on function public.set_employee_permissions(uuid, text[]) to authenticated;

-- Employees can no longer be deactivated directly: that needs the other boss's approval.
create or replace function public.deactivate_account(target uuid)
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

  if target_role = 'agent' then
    raise exception 'an employee is removed through a removal request approved by the other Direction account' using errcode = '42501';
  end if;

  if target_role <> 'client' then
    raise exception 'owner and direction accounts can only be changed from the owner console' using errcode = '42501';
  end if;

  update public.profiles set disabled_at = now(), disabled_by = caller where id = target;
  insert into public.audit_log (actor, action, target) values (caller, 'deactivate_account', target);
end;
$$;

-- ───────────── 2. Two-boss approval to remove an employee ─────────────
create table public.employee_removal_requests (
  id uuid primary key default gen_random_uuid(),
  employee uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  reason text not null default '' check (char_length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create unique index employee_removal_one_pending on public.employee_removal_requests (employee) where status = 'pending';
create index employee_removal_requested_by_idx on public.employee_removal_requests (requested_by);
create index employee_removal_decided_by_idx on public.employee_removal_requests (decided_by);

alter table public.employee_removal_requests enable row level security;
revoke all on public.employee_removal_requests from anon;

create policy "direction reads removal requests" on public.employee_removal_requests
  for select to authenticated
  using ((select public.my_role()) = 'direction');
-- No insert/update/delete policies: only the functions below change requests.

create function public.request_employee_removal(employee uuid, reason text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target_role public.app_role;
  request_id uuid;
begin
  if public.my_role() is distinct from 'direction' then
    raise exception 'only direction accounts can request a removal' using errcode = '42501';
  end if;
  select p.role into target_role from public.profiles p where p.id = employee and p.disabled_at is null;
  if target_role is distinct from 'agent' then
    raise exception 'only active employees can be removed this way' using errcode = '42501';
  end if;
  begin
    insert into public.employee_removal_requests (employee, requested_by, reason)
    values (employee, caller, left(coalesce(reason, ''), 500))
    returning id into request_id;
  exception when unique_violation then
    raise exception 'a removal request is already pending for this employee' using errcode = '23505';
  end;
  insert into public.audit_log (actor, action, target, details)
  values (caller, 'request_employee_removal', employee, jsonb_build_object('request', request_id, 'reason', left(coalesce(reason, ''), 500)));
  return request_id;
end;
$$;

create function public.decide_employee_removal(request uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  r public.employee_removal_requests%rowtype;
begin
  if public.my_role() is distinct from 'direction' then
    raise exception 'only direction accounts can decide' using errcode = '42501';
  end if;
  select * into r from public.employee_removal_requests where id = request for update;
  if not found or r.status <> 'pending' then
    raise exception 'request not found or already decided' using errcode = 'P0002';
  end if;
  if r.requested_by = caller then
    raise exception 'the other Direction account must decide this request' using errcode = '42501';
  end if;

  if approve then
    update public.profiles set disabled_at = now(), disabled_by = caller
    where id = r.employee and role = 'agent' and disabled_at is null;
  end if;

  update public.employee_removal_requests
  set status = case when approve then 'approved' else 'rejected' end, decided_by = caller, decided_at = now()
  where id = request;

  insert into public.audit_log (actor, action, target, details)
  values (caller, case when approve then 'approve_employee_removal' else 'reject_employee_removal' end, r.employee, jsonb_build_object('request', request));
end;
$$;

create function public.cancel_employee_removal(request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  r public.employee_removal_requests%rowtype;
begin
  select * into r from public.employee_removal_requests where id = request for update;
  if not found or r.status <> 'pending' or r.requested_by is distinct from caller or public.my_role() is distinct from 'direction' then
    raise exception 'only the requester can cancel a pending request' using errcode = '42501';
  end if;
  update public.employee_removal_requests set status = 'cancelled', decided_by = caller, decided_at = now() where id = request;
  insert into public.audit_log (actor, action, target, details)
  values (caller, 'cancel_employee_removal', r.employee, jsonb_build_object('request', request));
end;
$$;

revoke all on function public.request_employee_removal(uuid, text) from public, anon;
revoke all on function public.decide_employee_removal(uuid, boolean) from public, anon;
revoke all on function public.cancel_employee_removal(uuid) from public, anon;
grant execute on function public.request_employee_removal(uuid, text) to authenticated;
grant execute on function public.decide_employee_removal(uuid, boolean) to authenticated;
grant execute on function public.cancel_employee_removal(uuid) to authenticated;

-- ───────────── 3. Travel programmes ─────────────
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  title_fr text not null check (char_length(title_fr) between 3 and 120),
  title_ar text not null default '' check (char_length(title_ar) <= 120),
  summary_fr text not null default '' check (char_length(summary_fr) <= 300),
  summary_ar text not null default '' check (char_length(summary_ar) <= 300),
  description_fr text not null default '' check (char_length(description_fr) <= 5000),
  description_ar text not null default '' check (char_length(description_ar) <= 5000),
  destination text not null default '' check (char_length(destination) <= 80),
  start_date date,
  end_date date,
  duration_days integer check (duration_days between 1 and 90),
  price_from_mad integer check (price_from_mad between 0 and 10000000),
  image_path text check (image_path ~ '^programs/[a-z0-9/_.-]+$' and char_length(image_path) <= 200),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index programs_status_published_idx on public.programs (status, published_at desc);
create index programs_created_by_idx on public.programs (created_by);
create index programs_updated_by_idx on public.programs (updated_by);

alter table public.programs enable row level security;
revoke insert, update, delete on public.programs from anon;

-- Visitors only see published programmes (anon must not evaluate has_permission(): no grant).
create policy "visitors read published programs" on public.programs
  for select to anon
  using (status = 'published');

create policy "signed-in read programs" on public.programs
  for select to authenticated
  using (status = 'published' or (select public.has_permission('programs.manage')));

create policy "staff create programs" on public.programs
  for insert to authenticated
  with check ((select public.has_permission('programs.manage')));

create policy "staff edit programs" on public.programs
  for update to authenticated
  using ((select public.has_permission('programs.manage')))
  with check ((select public.has_permission('programs.manage')));

create policy "direction deletes programs" on public.programs
  for delete to authenticated
  using ((select public.my_role()) = 'direction');

-- Authorship, timestamps and the publication date are set by the database, not the client.
create function public.stamp_program()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
  elsif new.status <> 'published' then
    new.published_at := null;
  end if;
  return new;
end;
$$;

create trigger stamp_program
  before insert or update on public.programs
  for each row execute function public.stamp_program();

-- Every change to a programme is written to the journal.
create function public.audit_program()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data public.programs%rowtype;
begin
  row_data := case when tg_op = 'DELETE' then old else new end;
  insert into public.audit_log (actor, action, target, details)
  values (
    (select auth.uid()),
    case tg_op when 'INSERT' then 'program_created' when 'UPDATE' then 'program_updated' else 'program_deleted' end,
    row_data.id,
    jsonb_build_object('slug', row_data.slug, 'status', row_data.status, 'title', row_data.title_fr)
  );
  return null;
end;
$$;

revoke all on function public.audit_program() from public, anon, authenticated;
revoke all on function public.stamp_program() from public, anon, authenticated;

create trigger audit_program
  after insert or update or delete on public.programs
  for each row execute function public.audit_program();
