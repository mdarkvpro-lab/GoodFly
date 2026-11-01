-- GoodFly — online booking requests (no payment).
-- A visitor sends a request; staff with "bookings.manage" call the client back and follow it up.
-- Visitors can never read, change or delete requests: they only go through submit_booking_request().

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^GF-[0-9A-F]{8}$'),
  program_id uuid references public.programs (id) on delete set null,
  program_title text not null default '' check (char_length(program_title) <= 120),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^\+?[0-9 ().-]{8,25}$'),
  phone_digits text not null check (phone_digits ~ '^[0-9]{8,15}$'),
  email text not null default '' check (char_length(email) <= 254),
  from_place text not null default '' check (char_length(from_place) <= 120),
  to_place text not null default '' check (char_length(to_place) <= 120),
  travel_dates text not null default '' check (char_length(travel_dates) <= 120),
  adults integer not null default 1 check (adults between 1 and 20),
  children integer not null default 0 check (children between 0 and 20),
  message text not null default '' check (char_length(message) <= 1000),
  lang text not null default 'fr' check (lang in ('fr', 'ar')),
  consent_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'in_progress', 'confirmed', 'cancelled')),
  staff_note text not null default '' check (char_length(staff_note) <= 1000),
  handled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index booking_requests_status_created_idx on public.booking_requests (status, created_at desc);
create index booking_requests_created_idx on public.booking_requests (created_at desc);
create index booking_requests_phone_idx on public.booking_requests (phone_digits, created_at desc);
create index booking_requests_program_idx on public.booking_requests (program_id);
create index booking_requests_handled_by_idx on public.booking_requests (handled_by);

alter table public.booking_requests enable row level security;
revoke all on public.booking_requests from anon;

create policy "staff read booking requests" on public.booking_requests
  for select to authenticated
  using ((select public.has_permission('bookings.manage')));
-- No insert/update/delete policies: only the functions below change requests.

-- ───────────── Visitor: send a request ─────────────
-- Returns the reference the client quotes on the phone. Limits: 3 requests per phone number
-- per 24 h, and 100 requests per hour for the whole site (spam protection).
create function public.submit_booking_request(p jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p ->> 'full_name', ''));
  v_phone text := btrim(coalesce(p ->> 'phone', ''));
  v_digits text := regexp_replace(coalesce(p ->> 'phone', ''), '[^0-9]', '', 'g');
  v_email text := lower(btrim(coalesce(p ->> 'email', '')));
  v_from text := btrim(coalesce(p ->> 'from_place', ''));
  v_to text := btrim(coalesce(p ->> 'to_place', ''));
  v_dates text := btrim(coalesce(p ->> 'travel_dates', ''));
  v_message text := btrim(coalesce(p ->> 'message', ''));
  v_lang text := coalesce(p ->> 'lang', 'fr');
  v_slug text := btrim(coalesce(p ->> 'program', ''));
  v_adults integer;
  v_children integer;
  v_program_id uuid;
  v_program_title text := '';
  v_ref text;
begin
  if coalesce(p ->> 'consent', '') <> 'true' then
    raise exception 'consent' using errcode = '22023';
  end if;

  begin
    v_adults := coalesce(nullif(p ->> 'adults', ''), '1')::integer;
    v_children := coalesce(nullif(p ->> 'children', ''), '0')::integer;
  exception when others then
    raise exception 'invalid' using errcode = '22023';
  end;

  if char_length(v_name) not between 2 and 120
     or v_phone !~ '^\+?[0-9 ().-]{8,25}$' or v_digits !~ '^[0-9]{8,15}$'
     or (v_email <> '' and (char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'))
     or char_length(v_from) > 120 or char_length(v_to) > 120 or char_length(v_dates) > 120
     or char_length(v_message) > 1000
     or v_adults not between 1 and 20 or v_children not between 0 and 20
     or v_lang not in ('fr', 'ar') then
    raise exception 'invalid' using errcode = '22023';
  end if;

  if v_slug <> '' then
    select pr.id, pr.title_fr into v_program_id, v_program_title
    from public.programs pr
    where pr.slug = v_slug and pr.status = 'published';
    if not found then
      raise exception 'program_unavailable' using errcode = 'P0002';
    end if;
  elsif v_to = '' then
    raise exception 'invalid' using errcode = '22023';
  end if;

  if (select count(*) from public.booking_requests b
      where b.phone_digits = v_digits and b.created_at > now() - interval '24 hours') >= 3
     or (select count(*) from public.booking_requests b
         where b.created_at > now() - interval '1 hour') >= 100 then
    raise exception 'too_many' using errcode = '54000';
  end if;

  loop
    v_ref := 'GF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.booking_requests
        (reference, program_id, program_title, full_name, phone, phone_digits, email,
         from_place, to_place, travel_dates, adults, children, message, lang)
      values
        (v_ref, v_program_id, coalesce(v_program_title, ''), v_name, v_phone, v_digits, v_email,
         v_from, v_to, v_dates, v_adults, v_children, v_message, v_lang);
      exit;
    exception when unique_violation then
      -- extremely rare reference collision: draw another one
    end;
  end loop;

  return v_ref;
end;
$$;

revoke all on function public.submit_booking_request(jsonb) from public;
grant execute on function public.submit_booking_request(jsonb) to anon, authenticated;

-- ───────────── Staff: follow up a request ─────────────
create function public.update_booking_request(request uuid, new_status text, note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  v_ref text;
begin
  if not public.has_permission('bookings.manage') then
    raise exception 'bookings.manage permission required' using errcode = '42501';
  end if;
  if new_status not in ('new', 'in_progress', 'confirmed', 'cancelled') or char_length(coalesce(note, '')) > 1000 then
    raise exception 'invalid' using errcode = '22023';
  end if;
  update public.booking_requests
  set status = new_status, staff_note = coalesce(note, ''), handled_by = caller, updated_at = now()
  where id = request
  returning reference into v_ref;
  if v_ref is null then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  insert into public.audit_log (actor, action, target, details)
  values (caller, 'booking_updated', request, jsonb_build_object('reference', v_ref, 'status', new_status));
end;
$$;

-- Removing a request (e.g. the client asks to erase their data, law 09-08) is reserved to Direction.
create function public.delete_booking_request(request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  v_ref text;
begin
  if public.my_role() is distinct from 'direction' then
    raise exception 'only direction accounts can delete booking requests' using errcode = '42501';
  end if;
  delete from public.booking_requests where id = request returning reference into v_ref;
  if v_ref is null then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  -- The journal keeps the reference only, never the client's personal data.
  insert into public.audit_log (actor, action, target, details)
  values (caller, 'booking_deleted', request, jsonb_build_object('reference', v_ref));
end;
$$;

revoke all on function public.update_booking_request(uuid, text, text) from public, anon;
revoke all on function public.delete_booking_request(uuid) from public, anon;
grant execute on function public.update_booking_request(uuid, text, text) to authenticated;
grant execute on function public.delete_booking_request(uuid) to authenticated;
