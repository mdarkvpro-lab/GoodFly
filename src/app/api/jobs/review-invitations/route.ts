import { createHash, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/config/site";
import { mailConfigured, sendMail } from "@/lib/notify/mail";
import { reviewInviteMail } from "@/lib/notify/mail-text";
import { publicClient } from "@/lib/programs/data";

/**
 * Called once a day by the Netlify scheduled function (netlify/functions/review-invitations.ts).
 * Asks the database for the trips that ended 2 days ago and e-mails each client a private link.
 * Protected by the server-only BOOKING_FORM_KEY (sent as a Bearer token, compared in constant time);
 * the database checks the same key again.
 */
const digest = (s: string) => createHash("sha256").update(s).digest();

export async function POST(request: Request): Promise<Response> {
  const key = process.env.BOOKING_FORM_KEY;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!key || !timingSafeEqual(digest(given), digest(key))) return new Response(null, { status: 401 });

  const db = publicClient();
  if (!db || !mailConfigured()) return Response.json({ error: "config" }, { status: 500 });

  const { data, error } = await db.rpc("due_review_invitations", { form_key: key });
  if (error) {
    console.error("[reviews] invitations failed:", error.message);
    return Response.json({ error: "database" }, { status: 502 });
  }

  const rows = (data ?? []) as { token: string; email: string; first_name: string; lang: "fr" | "ar"; destination: string }[];
  let sent = 0;
  for (const r of rows) {
    const lang = r.lang === "ar" ? "ar" : "fr";
    const mail = reviewInviteMail(lang, r.first_name, r.destination, `${siteUrl()}/${lang}/avis/${r.token}`);
    if (await sendMail({ to: r.email, ...mail })) sent++;
  }
  console.log(`[reviews] ${sent}/${rows.length} invitation(s) sent`);
  return Response.json({ due: rows.length, sent });
}
