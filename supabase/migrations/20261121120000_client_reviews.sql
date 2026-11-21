-- GoodFly — client reviews after the trip.
--  1. Staff record the real return date when a booking is confirmed.
--  2. Every day a job asks for the trips that ended 2 days ago and e-mails the client a private link.
--  3. The client gives 1-5 stars and a comment; nothing is public until staff approve it.
--  4. Approved reviews are read by the homepage through public_reviews() (no name unless the client agreed).
-- The link's token is never stored in clear: only its SHA-256.

-- ───────────── 1. Return date of a confirmed trip ─────────────
alter table public.booking_requests
  add column return_date date,
  add column review_invited_at timestamptz;

create index booking_requests_review_due_idx on public.booking_requests (return_date)
  where status = 'confirmed' and review_invited_at is null;

create function public.update_booking_request(request uuid, new_status text, note text, return_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  v_ref text;
  v_created date;
begin
  if not public.has_permission('bookings.manage') then
    raise exception 'bookings.manage' using errcode = '42501';
  end if;
  if new_status not in ('new', 'in_progress', 'confirmed', 'cancelled') or char_length(coalesce(note, '')) > 1000 then
    raise exception 'invalid' using errcode = '22023';
  end if;
  select b.created_at::date into v_created from public.booking_requests b where b.id = request;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  -- A return date is a real date of this trip: not before the request, at most 2 years later.
  if return_on is not null and (return_on < v_created or return_on > v_created + interval '2 years') then
    raise exception 'return_date' using errcode = '22023';
  end if;

  update public.booking_requests
  set status = new_status, staff_note = coalesce(note, ''), return_date = return_on, handled_by = caller, updated_at = now()
  where id = request
  returning reference into v_ref;

  insert into public.audit_log (actor, action, target, details)
  values (caller, 'booking_updated', request,
          jsonb_build_object('reference', v_ref, 'status', new_status, 'return_date', return_on));
end;
$$;

revoke all on function public.update_booking_request(uuid, text, text, date) from public, anon;
grant execute on function public.update_booking_request(uuid, text, text, date) to authenticated;

-- ───────────── 2. Reviews ─────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique references public.booking_requests (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  reference text not null default '',
  lang text not null default 'fr' check (lang in ('fr', 'ar')),
  -- Shown with the review only if the client agrees: first name + initial ("Fatima Z.").
  display_name text not null default '' check (char_length(display_name) <= 60),
  destination text not null default '' check (char_length(destination) <= 120),
  trip_month date,
  status text not null default 'invited' check (status in ('invited', 'pending', 'approved', 'rejected')),
  rating smallint check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  show_name boolean not null default false,
  invited_at timestamptz not null default now(),
  submitted_at timestamptz,
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  check (status = 'invited' or rating is not null)
);

create index reviews_status_idx on public.reviews (status, submitted_at desc);
create index reviews_moderated_by_idx on public.reviews (moderated_by);

alter table public.reviews enable row level security;
revoke all on public.reviews from anon;

-- Staff who follow bookings read reviews; nobody writes them except through the functions below.
create policy "staff read reviews" on public.reviews
  for select to authenticated
  using ((select public.has_permission('bookings.manage')));

-- Same server-only key as the booking form: only this site's server can call the visitor functions.
create function private.form_key_ok(form_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select form_key is not null and exists (
    select 1 from private.settings s
    where s.name = 'booking_form_key_sha256' and s.value = encode(sha256(convert_to(form_key, 'UTF8')), 'hex'))
$$;

-- "Fatima Zahra El Idrissi" → "Fatima E." (never the full name).
create function private.short_name(full_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    case when array_length(parts, 1) > 1 then parts[1] || ' ' || left(parts[array_length(parts, 1)], 1) || '.'
         else coalesce(parts[1], '') end, 60)
  from (select regexp_split_to_array(btrim(coalesce(full_name, '')), '\s+') as parts) p
$$;

-- ───────────── Daily job: invitations to send ─────────────
-- Trips confirmed by staff that ended at least 2 days ago (and at most 30), with an e-mail,
-- not yet invited. Creates the review row and returns the link token once, to be e-mailed.
create function public.due_review_invitations(form_key text)
returns table (token text, email text, first_name text, lang text, destination text, reference text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  b record;
  v_token text;
begin
  if not private.form_key_ok(form_key) then
    raise exception 'form_key' using errcode = '42501';
  end if;
  for b in
    select r.id, r.email, r.full_name, r.lang, r.reference, r.return_date,
           coalesce(nullif(r.program_title, ''), nullif(r.to_place, ''), '') as dest
    from public.booking_requests r
    where r.status = 'confirmed' and r.review_invited_at is null and r.email <> ''
      and r.return_date between current_date - 30 and current_date - 2
    order by r.return_date
    limit 50
    for update skip locked
  loop
    -- 244 random bits (two v4 UUIDs), hex.
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    insert into public.reviews (booking_id, token_hash, reference, lang, display_name, destination, trip_month)
    values (b.id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), b.reference, b.lang,
            private.short_name(b.full_name), left(b.dest, 120), date_trunc('month', b.return_date)::date)
    on conflict (booking_id) do nothing;
    if found then
      update public.booking_requests set review_invited_at = now() where id = b.id;
      token := v_token;
      email := b.email;
      first_name := split_part(btrim(b.full_name), ' ', 1);
      lang := b.lang;
      destination := left(b.dest, 120);
      reference := b.reference;
      return next;
    end if;
  end loop;
end;
$$;

-- ───────────── Visitor: open and answer the link ─────────────
-- The link works for 60 days and only once.
create function public.review_by_token(form_key text, token text)
returns table (state text, first_name text, destination text, lang text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.reviews;
begin
  if not private.form_key_ok(form_key) then
    raise exception 'form_key' using errcode = '42501';
  end if;
  if coalesce(token, '') !~ '^[0-9a-f]{64}$' then
    state := 'invalid';
    return next;
    return;
  end if;
  select * into v from public.reviews r where r.token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex');
  if not found then
    state := 'invalid';
  elsif v.status <> 'invited' then
    state := 'done';
  elsif v.invited_at < now() - interval '60 days' then
    state := 'expired';
  else
    state := 'open';
    first_name := split_part(v.display_name, ' ', 1);
    destination := v.destination;
    lang := v.lang;
  end if;
  return next;
end;
$$;

-- Returns the booking reference (for the Direction alert on a low rating).
create function public.submit_review(form_key text, token text, stars integer, review text, show_name boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text;
  v_comment text := btrim(coalesce(review, ''));
begin
  if not private.form_key_ok(form_key) then
    raise exception 'form_key' using errcode = '42501';
  end if;
  if coalesce(token, '') !~ '^[0-9a-f]{64}$' or stars is null or stars not between 1 and 5 or char_length(v_comment) > 1000 then
    raise exception 'invalid' using errcode = '22023';
  end if;
  update public.reviews r
  set status = 'pending', rating = stars, comment = v_comment, show_name = coalesce(submit_review.show_name, false), submitted_at = now()
  where r.token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')
    and r.status = 'invited' and r.invited_at >= now() - interval '60 days'
  returning r.reference into v_ref;
  if not found then
    raise exception 'unavailable' using errcode = 'P0002';
  end if;
  return v_ref;
end;
$$;

-- ───────────── Staff: approve or reject ─────────────
create function public.moderate_review(review uuid, decision text)
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
    raise exception 'bookings.manage' using errcode = '42501';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'invalid' using errcode = '22023';
  end if;
  update public.reviews r
  set status = decision, moderated_by = caller, moderated_at = now()
  where r.id = review and r.status in ('pending', 'approved', 'rejected')
  returning r.reference into v_ref;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.audit_log (actor, action, target, details)
  values (caller, 'review_' || decision, review, jsonb_build_object('reference', v_ref));
end;
$$;

-- ───────────── Homepage: approved reviews only, safe columns only ─────────────
create function public.public_reviews()
returns table (id uuid, rating smallint, comment text, name text, destination text, trip_month date, lang text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.rating, r.comment, case when r.show_name then r.display_name else '' end,
         r.destination, r.trip_month, r.lang
  from public.reviews r
  where r.status = 'approved'
  order by r.submitted_at desc
  limit 12
$$;

revoke all on function private.form_key_ok(text) from public, anon, authenticated;
revoke all on function public.due_review_invitations(text) from public;
revoke all on function public.review_by_token(text, text) from public;
revoke all on function public.submit_review(text, text, integer, text, boolean) from public;
revoke all on function public.moderate_review(uuid, text) from public, anon;
revoke all on function public.public_reviews() from public;
grant execute on function public.due_review_invitations(text) to anon;
grant execute on function public.review_by_token(text, text) to anon;
grant execute on function public.submit_review(text, text, integer, text, boolean) to anon;
grant execute on function public.moderate_review(uuid, text) to authenticated;
grant execute on function public.public_reviews() to anon, authenticated;
