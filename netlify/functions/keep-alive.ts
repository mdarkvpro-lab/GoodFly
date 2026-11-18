/**
 * Netlify Scheduled Function: once a day, one tiny read from the database.
 * Supabase's free plan pauses a project after 7 days without activity; while the site has few
 * visitors, this keeps the booking form and the staff area working. Public data only, no secret.
 */
export default async function keepAlive(): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("[keep-alive] Supabase settings missing");
    return new Response("missing settings", { status: 500 });
  }
  try {
    const res = await fetch(`${url}/rest/v1/programs?select=id&limit=1`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(15_000),
    });
    console.log(`[keep-alive] database answered ${res.status}`);
    return new Response(null, { status: res.ok ? 204 : 502 });
  } catch (e) {
    console.error("[keep-alive] database unreachable:", (e as Error).name);
    return new Response("unreachable", { status: 502 });
  }
}

// Every day at 06:00 UTC.
export const config = { schedule: "0 6 * * *" };
