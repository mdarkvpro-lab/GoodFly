import "server-only";
import { resolve4, resolveMx } from "node:dns/promises";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * E-mails sent from the agency's Gmail account (free, ~500 per day) with an app password.
 * Configured by `npm run mail:setup` (MAIL_USER, MAIL_PASSWORD in .env.local, never in git).
 * MAIL_HOST / MAIL_PORT exist only so the tests can use a local mail catcher.
 */
export function mailConfigured() {
  return Boolean(process.env.MAIL_USER && process.env.MAIL_PASSWORD);
}

let transport: Transporter | null = null;
function transporter() {
  if (!mailConfigured()) return null;
  if (!transport) {
    const port = Number(process.env.MAIL_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.MAIL_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transport;
}

export type Mail = { to: string | string[]; subject: string; text: string; html?: string; replyTo?: string };

/** Sends one e-mail. Returns false (never throws) when mail is not configured or sending fails. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const t = transporter();
  const recipients = [mail.to].flat().filter(Boolean);
  if (!t || !recipients.length) return false;
  try {
    await t.sendMail({ from: { name: "GoodFly", address: process.env.MAIL_USER! }, ...mail, to: recipients });
    return true;
  } catch (e) {
    console.error("[mail] send failed:", (e as { code?: string; responseCode?: number })?.responseCode ?? (e as { code?: string })?.code ?? "error");
    return false;
  }
}

/** Throw-away inbox services: an address there proves nothing about the client. */
const DISPOSABLE = new Set([
  "mailinator.com", "yopmail.com", "yopmail.fr", "guerrillamail.com", "guerrillamail.net", "sharklasers.com",
  "10minutemail.com", "10minutemail.net", "temp-mail.org", "tempmail.com", "tempmail.net", "throwawaymail.com",
  "trashmail.com", "getnada.com", "dispostable.com", "maildrop.cc", "mohmal.com", "emailondeck.com",
  "fakeinbox.com", "mintemail.com", "mailnesia.com", "tempr.email", "discard.email", "spamgourmet.com",
]);

/**
 * Can this address receive mail? "disposable" for throw-away inboxes, "domain" when the domain
 * has no mail server (typo like gmial.com). A DNS failure on our side never blocks the client.
 */
export async function emailDomainProblem(email: string): Promise<"disposable" | "domain" | null> {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (DISPOSABLE.has(domain)) return "disposable";
  const within = <T,>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), 4000))]);
  try {
    const mx = await within(resolveMx(domain));
    return mx.some((r) => r.exchange && r.exchange !== ".") ? null : "domain";
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ENOTFOUND") return "domain";
    if (code !== "ENODATA") return null;
    // No MX record: mail may still go to the domain's own address (rare, but valid).
    return within(resolve4(domain)).then((a) => (a.length ? null : "domain"), () => "domain");
  }
}
