-- GoodFly — push notifications on staff phones/computers for new booking requests (free, no third-party account).
-- Each staff device registers a Web Push subscription. Only the site server (form key) can list
-- the devices to notify, and only for active accounts that may manage bookings.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Only the browsers' official push services: the server never posts anywhere else.
  endpoint text not null unique check (
    char_length(endpoint) <= 1000
    and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
  ),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{16,32}$'),
  device text not null default '' check (char_length(device) <= 120),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;

-- A staff member manages the devices of their own account only.
create policy "own push devices" on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "add own push device" on public.push_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_permission('bookings.manage')));

create policy "remove own push device" on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Server side (form key): devices to alert, for active accounts allowed to manage bookings.
create function public.booking_push_targets(form_key text)
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
  return query
    select ps.endpoint, ps.p256dh, ps.auth
    from public.push_subscriptions ps
    join public.profiles pr on pr.id = ps.user_id
    where pr.disabled_at is null
      and (pr.role = 'direction' or (pr.role = 'agent' and 'bookings.manage' = any (pr.permissions)));
end;
$$;

-- Server side (form key): forget a device the push service reports as gone (expired or unsubscribed).
create function public.forget_push_endpoint(form_key text, gone text)
returns void
language plpgsql
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
  delete from public.push_subscriptions where endpoint = gone;
end;
$$;

revoke all on function public.booking_push_targets(text) from public;
revoke all on function public.forget_push_endpoint(text, text) from public;
grant execute on function public.booking_push_targets(text) to anon, authenticated;
grant execute on function public.forget_push_endpoint(text, text) to anon, authenticated;
