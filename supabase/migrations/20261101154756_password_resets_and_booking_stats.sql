-- GoodFly — 1. Direction resets a forgotten employee password (temporary password),
--            at most 10 times per account in 30 days (enforced here, not only in the app).
--            2. Booking statistics for the dashboard, without any client details.

-- ───────────── 1. Password resets ─────────────
create table public.password_resets (
  id uuid primary key default gen_random_uuid(),
  target uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index password_resets_target_created_idx on public.password_resets (target, created_at desc);
create index password_resets_requested_by_idx on public.password_resets (requested_by);

alter table public.password_resets enable row level security;
revoke all on public.password_resets from anon;

-- Direction sees how many resets each account had; nobody writes from the website
-- (rows are added by the reset-employee-password Edge Function with the secret key).
create policy "direction reads password resets" on public.password_resets
  for select to authenticated
  using ((select public.my_role()) = 'direction');

create function public.limit_password_resets()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- One reset at a time per account, so two simultaneous requests cannot both pass the count.
  perform pg_advisory_xact_lock(hashtext('password_reset:' || new.target::text));
  if (select count(*) from public.password_resets r
      where r.target = new.target and r.created_at > now() - interval '30 days') >= 10 then
    raise exception 'reset_limit' using errcode = '54000';
  end if;
  new.created_at := now();
  return new;
end;
$$;

revoke all on function public.limit_password_resets() from public, anon, authenticated;

create trigger limit_password_resets
  before insert on public.password_resets
  for each row execute function public.limit_password_resets();

-- ───────────── 2. Booking statistics ─────────────
-- Dates and statuses only (no names, phones or e-mails), for accounts with "reports.view".
create function public.staff_booking_stats()
returns table (created_at timestamptz, status text)
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
    select b.created_at, b.status
    from public.booking_requests b
    where b.created_at > now() - interval '13 months';
end;
$$;

revoke all on function public.staff_booking_stats() from public, anon;
grant execute on function public.staff_booking_stats() to authenticated;
