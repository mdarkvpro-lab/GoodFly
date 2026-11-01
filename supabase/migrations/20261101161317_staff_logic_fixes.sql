-- GoodFly — staff logic fixes.
-- 1. Bringing back a removed employee also needs the OTHER Direction account's approval
--    (same two-boss rule as removing one).
-- 2. No customer accounts exist on the website (customers send booking requests), so the
--    "clients.view" permission and the client → employee promotion are removed.

-- ───────────── 1. Restore requests ─────────────
alter table public.employee_removal_requests
  add column kind text not null default 'remove' check (kind in ('remove', 'restore'));

create function public.request_employee_restore(employee uuid, reason text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target_role public.app_role;
  disabled timestamptz;
  request_id uuid;
begin
  if public.my_role() is distinct from 'direction' then
    raise exception 'only direction accounts can request a restore' using errcode = '42501';
  end if;
  select p.role, p.disabled_at into target_role, disabled from public.profiles p where p.id = employee;
  if target_role is distinct from 'agent' or disabled is null then
    raise exception 'only removed employees can be restored this way' using errcode = '42501';
  end if;
  if disabled < now() - interval '30 days' then
    raise exception 'the 30-day restore window has passed' using errcode = '42501';
  end if;
  begin
    insert into public.employee_removal_requests (employee, requested_by, reason, kind)
    values (employee, caller, left(coalesce(reason, ''), 500), 'restore')
    returning id into request_id;
  exception when unique_violation then
    raise exception 'a request is already pending for this employee' using errcode = '23505';
  end;
  insert into public.audit_log (actor, action, target, details)
  values (caller, 'request_employee_restore', employee, jsonb_build_object('request', request_id, 'reason', left(coalesce(reason, ''), 500)));
  return request_id;
end;
$$;

revoke all on function public.request_employee_restore(uuid, text) from public, anon;
grant execute on function public.request_employee_restore(uuid, text) to authenticated;

-- The same decision handles both kinds of request.
create or replace function public.decide_employee_removal(request uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  r public.employee_removal_requests%rowtype;
  disabled timestamptz;
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

  if approve and r.kind = 'remove' then
    update public.profiles set disabled_at = now(), disabled_by = caller
    where id = r.employee and role = 'agent' and disabled_at is null;
  elsif approve and r.kind = 'restore' then
    select p.disabled_at into disabled from public.profiles p where p.id = r.employee and p.role = 'agent' for update;
    if disabled is null then
      raise exception 'only removed employees can be restored this way' using errcode = '42501';
    end if;
    if disabled < now() - interval '30 days' then
      raise exception 'the 30-day restore window has passed' using errcode = '42501';
    end if;
    update public.profiles set disabled_at = null, disabled_by = null where id = r.employee;
  end if;

  update public.employee_removal_requests
  set status = case when approve then 'approved' else 'rejected' end, decided_by = caller, decided_at = now()
  where id = request;

  insert into public.audit_log (actor, action, target, details)
  values (
    caller,
    case
      when r.kind = 'restore' then case when approve then 'approve_employee_restore' else 'reject_employee_restore' end
      else case when approve then 'approve_employee_removal' else 'reject_employee_removal' end
    end,
    r.employee,
    jsonb_build_object('request', request)
  );
end;
$$;

-- Removal requests are only for active employees, restore requests only for removed ones.
create or replace function public.request_employee_removal(employee uuid, reason text default '')
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
    insert into public.employee_removal_requests (employee, requested_by, reason, kind)
    values (employee, caller, left(coalesce(reason, ''), 500), 'remove')
    returning id into request_id;
  exception when unique_violation then
    raise exception 'a request is already pending for this employee' using errcode = '23505';
  end;
  insert into public.audit_log (actor, action, target, details)
  values (caller, 'request_employee_removal', employee, jsonb_build_object('request', request_id, 'reason', left(coalesce(reason, ''), 500)));
  return request_id;
end;
$$;

-- A Direction account alone can no longer bring back an employee.
create or replace function public.restore_account(target uuid)
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

  if target_role = 'agent' then
    raise exception 'an employee comes back through a restore request approved by the other Direction account' using errcode = '42501';
  end if;

  if target_role <> 'client' then
    raise exception 'owner and direction accounts can only be changed from the owner console' using errcode = '42501';
  end if;

  if disabled < now() - interval '30 days' then
    raise exception 'the 30-day restore window has passed' using errcode = '42501';
  end if;

  update public.profiles set disabled_at = null, disabled_by = null where id = target;
  insert into public.audit_log (actor, action, target) values (caller, 'restore_account', target);
end;
$$;

-- ───────────── 2. No customer accounts in the staff area ─────────────
update public.profiles set permissions = array_remove(permissions, 'clients.view') where 'clients.view' = any (permissions);

alter table public.profiles drop constraint profiles_permissions_check;
alter table public.profiles
  add constraint profiles_permissions_check
  check (permissions <@ array['programs.manage', 'reports.view', 'bookings.manage']::text[]);

create or replace function public.set_employee_permissions(employee uuid, perms text[])
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
  if not clean <@ array['programs.manage', 'reports.view', 'bookings.manage']::text[] then
    raise exception 'unknown permission' using errcode = '22023';
  end if;
  update public.profiles set permissions = clean where id = employee;
  insert into public.audit_log (actor, action, target, details)
  values ((select auth.uid()), 'set_employee_permissions', employee, jsonb_build_object('permissions', clean));
end;
$$;

-- Employees see only their own profile; Direction sees every account.
drop policy "read profiles" on public.profiles;
create policy "read profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.my_role()) = 'direction');

-- Roles never change from the website any more: employees are created in "Employés"
-- (Edge Function) and Direction accounts in the owner console.
create function public.block_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and new.role is distinct from old.role then
    raise exception 'roles are managed by the owner console and the Employés page' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.block_role_change() from public, anon, authenticated;

create trigger block_role_change
  before update on public.profiles
  for each row execute function public.block_role_change();
