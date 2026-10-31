-- Hardening after the Supabase advisors review (2026-10-31).

-- 1. handle_new_user() is only a sign-up trigger: nobody may call it through the API.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- 2. Indexes for foreign keys and for the journal views.
create index audit_log_actor_idx on public.audit_log (actor);
create index audit_log_target_idx on public.audit_log (target);
create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index profiles_disabled_by_idx on public.profiles (disabled_by);

-- 3. One permissive policy per action (same rules, evaluated once per row).
drop policy "read own profile" on public.profiles;
drop policy "direction reads all profiles" on public.profiles;
drop policy "agents read client profiles" on public.profiles;

create policy "read profiles" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.my_role()) = 'direction'
    or ((select public.my_role()) = 'agent' and role = 'client')
  );

drop policy "update own profile" on public.profiles;
drop policy "direction updates agents and clients" on public.profiles;

create policy "update profiles" on public.profiles
  for update to authenticated
  using (
    (id = (select auth.uid()) and (select public.my_role()) is not null)
    or ((select public.my_role()) = 'direction' and role in ('agent', 'client'))
  )
  with check (
    id = (select auth.uid())
    or ((select public.my_role()) = 'direction' and role in ('agent', 'client'))
  );
