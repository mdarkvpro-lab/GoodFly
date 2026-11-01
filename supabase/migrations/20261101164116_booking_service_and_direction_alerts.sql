-- GoodFly — 1. Booking requests remember which service the client asked for
--            (flight, stay, visa; empty = general request or programme).
--            2. Phone alerts between the two Direction accounts for removal/restore requests.

-- ───────────── 1. Service of a booking request ─────────────
alter table public.booking_requests
  add column service text not null default '' check (service in ('', 'flight', 'stay', 'visa'));

create or replace function public.submit_booking_request(p jsonb, form_key text, ip_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected text := (select s.value from private.settings s where s.name = 'booking_form_key_sha256');
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
  v_ip text := lower(coalesce(ip_hash, ''));
  v_service text := coalesce(p ->> 'service', '');
  v_adults integer;
  v_children integer;
  v_program_id uuid;
  v_program_title text := '';
  v_ref text;
begin
  if v_expected is null or form_key is null
     or encode(sha256(convert_to(form_key, 'UTF8')), 'hex') <> v_expected then
    raise exception 'form_key' using errcode = '42501';
  end if;
  if v_ip !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid' using errcode = '22023';
  end if;

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
     or v_lang not in ('fr', 'ar')
     or v_service not in ('', 'flight', 'stay', 'visa') then
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
         where b.ip_hash = v_ip and b.created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.booking_requests b
         where b.ip_hash = v_ip and b.created_at > now() - interval '24 hours') >= 10
     or (select count(*) from public.booking_requests b
         where b.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'too_many' using errcode = '54000';
  end if;

  loop
    v_ref := 'GF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.booking_requests
        (reference, program_id, program_title, full_name, phone, phone_digits, email,
         from_place, to_place, travel_dates, adults, children, message, lang, ip_hash, service)
      values
        (v_ref, v_program_id, coalesce(v_program_title, ''), v_name, v_phone, v_digits, v_email,
         v_from, v_to, v_dates, v_adults, v_children, v_message, v_lang, v_ip, v_service);
      exit;
    exception when unique_violation then
      -- extremely rare reference collision: draw another one
    end;
  end loop;

  return v_ref;
end;
$$;

-- ───────────── 2. Direction devices for request alerts ─────────────
-- Server side (form key) + the caller must be an active Direction account: devices of the
-- OTHER active Direction account(s), to tell them a decision is waiting (or was taken).
create function public.direction_push_targets(form_key text, recipient uuid)
returns table (endpoint text, p256dh text, auth text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_expected text := (select s.value from private.settings s where s.name = 'booking_form_key_sha256');
begin
  if v_expected is null or form_key is null
     or encode(sha256(convert_to(form_key, 'UTF8')), 'hex') <> v_expected then
    raise exception 'form_key' using errcode = '42501';
  end if;
  if public.my_role() is distinct from 'direction' then
    raise exception 'only direction accounts' using errcode = '42501';
  end if;
  if recipient = (select auth.uid()) then
    raise exception 'alerts go to the other Direction account' using errcode = '42501';
  end if;
  return query
    select ps.endpoint, ps.p256dh, ps.auth
    from public.push_subscriptions ps
    join public.profiles pr on pr.id = ps.user_id
    where ps.user_id = recipient and pr.role = 'direction' and pr.disabled_at is null;
end;
$$;

revoke all on function public.direction_push_targets(text, uuid) from public, anon;
grant execute on function public.direction_push_targets(text, uuid) to authenticated;
