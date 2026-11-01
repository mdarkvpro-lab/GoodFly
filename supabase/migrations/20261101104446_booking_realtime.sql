-- Live alerts in the staff area: new booking requests are pushed over Supabase Realtime.
-- Realtime applies the table's RLS to every subscriber, so only accounts with
-- "bookings.manage" (and Direction) receive the events. Visitors (anon) receive nothing.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.booking_requests;
  end if;
end;
$$;
