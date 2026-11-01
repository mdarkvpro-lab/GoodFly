-- GoodFly — booking requests need a verified e-mail address (6-digit code sent by e-mail),
-- and the server can e-mail new requests to the Direction accounts.
--
-- 1. private.email_codes keeps only a keyed hash of each code (HMAC made by the site server),
--    valid 10 minutes, 5 tries, at most 1 per minute and 3 per hour for one address,
--    10 per hour for one visitor (IP hash), 200 per day for the whole site (Gmail allows ~500 e-mails).
-- 2. check_email_code() returns a status instead of raising, so failed tries are counted.
-- 3. submit_booking_request() now refuses a request whose e-mail was not verified in the
--    last 30 minutes, and uses each verification once.
-- 4. direction_emails(): addresses of the active Direction accounts, for the server only.

create table private.email_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  verified_at timestamptz,
  used_at timestamptz
);
create index email_codes_email_idx on private.email_codes (email, created_at desc);
create index email_codes_ip_idx on private.email_codes (ip_hash, created_at desc);
create index email_codes_created_idx on private.email_codes (created_at);
revoke all on private.email_codes from public, anon, authenticated;

create function private.assert_form_key(form_key text)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_expected text := (select s.value from private.settings s where s.name = 'booking_form_key_sha256');
begin
  if v_expected is null or form_key is null
     or encode(sha256(convert_to(form_key, 'UTF8')), 'hex') <> v_expected then
    raise exception 'form_key' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.assert_form_key(text) from public, anon, authenticated;

create function private.valid_email(email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select email is not null and char_length(email) <= 254
     and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
$$;
revoke all on function private.valid_email(text) from public, anon, authenticated;

-- ───────────── 1. A new code ─────────────
create function public.create_email_code(form_key text, email text, code_hash text, ip_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(email, '')));
  v_ip text := lower(coalesce(ip_hash, ''));
  v_hash text := lower(coalesce(code_hash, ''));
begin
  perform private.assert_form_key(form_key);
  if not private.valid_email(v_email) or v_ip !~ '^[0-9a-f]{64}$' or v_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid' using errcode = '22023';
  end if;

  -- Old codes are useless after two days.
  delete from private.email_codes c where c.created_at < now() - interval '2 days';

  if exists (select 1 from private.email_codes c
             where c.email = v_email and c.created_at > now() - interval '60 seconds') then
    raise exception 'wait' using errcode = '54000';
  end if;
  if (select count(*) from private.email_codes c
      where c.email = v_email and c.created_at > now() - interval '1 hour') >= 3
     or (select count(*) from private.email_codes c
         where c.ip_hash = v_ip and c.created_at > now() - interval '1 hour') >= 10
     or (select count(*) from private.email_codes c
         where c.created_at > now() - interval '24 hours') >= 200 then
    raise exception 'too_many' using errcode = '54000';
  end if;

  insert into private.email_codes (email, code_hash, ip_hash) values (v_email, v_hash, v_ip);
end;
$$;
revoke all on function public.create_email_code(text, text, text, text) from public;
grant execute on function public.create_email_code(text, text, text, text) to anon, authenticated;

-- ───────────── 2. Checking a code ─────────────
-- 'ok' | 'wrong' | 'expired' | 'locked'. Only the latest unused code of the address counts.
create function public.check_email_code(form_key text, email text, code_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(email, '')));
  v_row private.email_codes;
begin
  perform private.assert_form_key(form_key);
  select * into v_row from private.email_codes c
  where c.email = v_email and c.used_at is null
  order by c.created_at desc
  limit 1
  for update;

  if not found or v_row.expires_at < now() then
    return 'expired';
  end if;
  if v_row.attempts >= 5 then
    return 'locked';
  end if;
  if v_row.code_hash <> lower(coalesce(code_hash, '')) then
    update private.email_codes c set attempts = c.attempts + 1 where c.id = v_row.id;
    return case when v_row.attempts + 1 >= 5 then 'locked' else 'wrong' end;
  end if;
  update private.email_codes c set verified_at = coalesce(c.verified_at, now()) where c.id = v_row.id;
  return 'ok';
end;
$$;
revoke all on function public.check_email_code(text, text, text) from public;
grant execute on function public.check_email_code(text, text, text) to anon, authenticated;

-- ───────────── 3. Requests need a verified address ─────────────
create or replace function public.submit_booking_request(p jsonb, form_key text, ip_hash text)
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
  v_ip text := lower(coalesce(ip_hash, ''));
  v_service text := coalesce(p ->> 'service', '');
  v_adults integer;
  v_children integer;
  v_program_id uuid;
  v_program_title text := '';
  v_code_id uuid;
  v_ref text;
begin
  perform private.assert_form_key(form_key);
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
     or not private.valid_email(v_email)
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

  -- The e-mail address was proven with a code in the last 30 minutes (each proof is used once).
  select c.id into v_code_id from private.email_codes c
  where c.email = v_email and c.verified_at > now() - interval '30 minutes' and c.used_at is null
  order by c.verified_at desc
  limit 1
  for update;
  if not found then
    raise exception 'email_unverified' using errcode = '42501';
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

  update private.email_codes c set used_at = now() where c.id = v_code_id;
  return v_ref;
end;
$$;

-- ───────────── 4. Direction addresses for new-request e-mails ─────────────
create function public.direction_emails(form_key text)
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_form_key(form_key);
  return query
    select pr.email from public.profiles pr
    where pr.role = 'direction' and pr.disabled_at is null and private.valid_email(pr.email);
end;
$$;
revoke all on function public.direction_emails(text) from public;
grant execute on function public.direction_emails(text) to anon, authenticated;
