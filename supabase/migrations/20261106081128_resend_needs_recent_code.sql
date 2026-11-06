-- "Resend the code" skips the anti-robot check only when this address already received a code
-- in the last 10 minutes (that first code needed the check). Otherwise a robot could call
-- "resend" directly and make the site e-mail strangers.
create function public.can_resend_email_code(form_key text, email text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(email, '')));
begin
  perform private.assert_form_key(form_key);
  return exists (
    select 1 from private.email_codes c
    where c.email = v_email and c.used_at is null and c.created_at > now() - interval '10 minutes'
  );
end;
$$;
revoke all on function public.can_resend_email_code(text, text) from public;
grant execute on function public.can_resend_email_code(text, text) to anon, authenticated;
