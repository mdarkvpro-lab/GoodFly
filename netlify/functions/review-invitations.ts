/**
 * Netlify Scheduled Function: once a day, asks the site to e-mail the review invitations
 * (trips that ended 2 days ago). The work is done by /api/jobs/review-invitations; this only
 * calls it with the server-only key. Needs SITE_URL and BOOKING_FORM_KEY in Netlify's settings.
 */
export default async function reviewInvitations(): Promise<Response> {
  const site = process.env.SITE_URL;
  const key = process.env.BOOKING_FORM_KEY;
  if (!site || !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(site) || !key) {
    console.error("[review-invitations] SITE_URL or BOOKING_FORM_KEY missing");
    return new Response("missing settings", { status: 500 });
  }
  try {
    const res = await fetch(`${site}/api/jobs/review-invitations`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(25_000),
    });
    console.log(`[review-invitations] ${res.status} ${await res.text()}`);
    return new Response(null, { status: res.ok ? 204 : 502 });
  } catch (e) {
    console.error("[review-invitations] site unreachable:", (e as Error).name);
    return new Response("unreachable", { status: 502 });
  }
}

// Every day at 09:00 UTC (10:00 in Morocco): a good hour to read an e-mail.
export const config = { schedule: "0 9 * * *" };
