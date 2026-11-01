-- GoodFly — booking requests may only come through the website's server, with a limit per visitor.
--
-- 1. Form key: the site server sends a secret key (env BOOKING_FORM_KEY, never in the browser).
--    The database keeps only its SHA-256 hash in a schema the API cannot reach.
--    Calling the function directly with the public key alone is refused.
-- 2. Per-visitor limit: the server sends a hash of the visitor's IP address (the IP itself is
--    never stored): 5 requests per hour and 10 per day from one address.
-- 3. The site-wide cap becomes a safety net only (300 per hour).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.settings (
  name text primary key,
  value text not null
);
revoke all on private.settings from public, anon, authenticated;
-- The hash is set once from the SQL editor / owner side:
--   insert into private.settings values ('booking_form_key_sha256', '<hex>')
--   on conflict (name) do update set value = excluded.value;

alter table public.booking_requests
  add column ip_hash text not null default '' check (ip_hash = '' or ip_hash ~ '^[0-9a-f]{64}$');
create index booking_requests_ip_idx on public.booking_requests (ip_hash, created_at desc);

drop function public.submit_booking_request(jsonb);

create function public.submit_booking_request(p jsonb, form_key text, ip_hash text)
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
         from_place, to_place, travel_dates, adults, children, message, lang, ip_hash)
      values
        (v_ref, v_program_id, coalesce(v_program_title, ''), v_name, v_phone, v_digits, v_email,
         v_from, v_to, v_dates, v_adults, v_children, v_message, v_lang, v_ip);
      exit;
    exception when unique_violation then
      -- extremely rare reference collision: draw another one
    end;
  end loop;

  return v_ref;
end;
$$;

revoke all on function public.submit_booking_request(jsonb, text, text) from public;
grant execute on function public.submit_booking_request(jsonb, text, text) to anon, authenticated;
