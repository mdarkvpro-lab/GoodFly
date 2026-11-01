-- Client statistics for the dashboard without exposing names or e-mails:
-- an employee with "reports.view" gets counts-ready rows (role + dates) only.
create function public.staff_profile_stats()
returns table (role public.app_role, created_at timestamptz, disabled_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('reports.view') then
    raise exception 'reports.view permission required' using errcode = '42501';
  end if;
  return query
    select p.role, p.created_at, p.disabled_at
    from public.profiles p
    where p.role in ('client', 'agent');
end;
$$;

revoke all on function public.staff_profile_stats() from public, anon;
grant execute on function public.staff_profile_stats() to authenticated;
