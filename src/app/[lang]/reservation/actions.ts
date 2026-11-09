"use server";

import { createHmac, randomInt } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { AGENCY } from "@/config/site";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { parseBooking, parseCode, type BookingErrors, type BookingInput } from "@/lib/bookings/validate";
import { verifyTurnstile } from "@/lib/bookings/turnstile";
import { bookingMessage, bookingPush, type BookingSummary } from "@/lib/notify/booking-message";
import { emailDomainProblem, mailConfigured, sendMail } from "@/lib/notify/mail";
import { codeMail, confirmationMail, staffBookingMail } from "@/lib/notify/mail-text";
import { pushToBookingStaff } from "@/lib/notify/push";
import { sendTelegram } from "@/lib/notify/telegram";
import { publicClient } from "@/lib/programs/data";

type FormError = "check" | "tooMany" | "programGone" | "generic" | "config" | "captcha" | "mail" | "wait" | "codeTooMany";
export type CodeError = "format" | "wrong" | "expired" | "locked";

export type BookingFormState =
  | { reference: string }
  /** Step 2: a code was sent to `email`; the form values travel in hidden fields. */
  | { step: "code"; email: string; values: Record<string, string>; codeError?: CodeError; resent?: boolean; error?: FormError }
  | { errors?: BookingErrors; error?: FormError; values: Record<string, string> }
  | undefined;

const FIELDS = ["full_name", "phone", "email", "from_place", "to_place", "travel_dates", "adults", "children", "message", "program", "service"] as const;
const echo = (form: FormData) => Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? "").slice(0, 1000)]));

/**
 * The visitor's address, keyed-hashed (never stored in clear). CLIENT_IP_HEADER names the header
 * the host itself sets and the visitor cannot fake (on Netlify: x-nf-client-connection-ip).
 * Without it, the first x-forwarded-for entry is only as trustworthy as the host's proxy.
 */
async function visitorIp() {
  const h = await headers();
  const trusted = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  const ip = (trusted && h.get(trusted)) || h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown";
  return ip.trim().slice(0, 64);
}

/** Link to the staff page for the alerts, only from configuration (never from the request's Host). */
function staffUrl() {
  const site = process.env.SITE_URL;
  return site && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(site) ? `${site}/fr/espace/reservations?statut=new` : undefined;
}

const hmac = (key: string, data: string) => createHmac("sha256", key).update(data).digest("hex");
/** The code is never stored: only this keyed hash, tied to the address. */
const codeHash = (key: string, email: string, code: string) => hmac(key, `email-code:${email}:${code}`);

/**
 * A visitor's booking request, in two steps:
 *  1. "send": checks the form, then e-mails a 6-digit code to the address given.
 *  2. "verify": checks the code, then saves the request through submit_booking_request()
 *     (the database re-checks everything, including that the address was verified).
 * "resend" sends a new code, "edit" goes back to the form.
 */
export async function submitBooking(_prev: BookingFormState, form: FormData): Promise<BookingFormState> {
  const values = echo(form);
  const intent = String(form.get("intent") ?? "send");
  // Hidden field humans never fill: silently refuse bots.
  if (String(form.get("website") ?? "") !== "") return { error: "generic", values };

  const parsed = parseBooking((k) => form.get(k));
  if (!parsed.ok) return { errors: parsed.errors, error: "check", values };
  if (intent === "edit") return { values };

  // Server-only key: proves the request came through this form (the database refuses others).
  const formKey = process.env.BOOKING_FORM_KEY;
  const db = publicClient();
  if (!db || !formKey || !mailConfigured()) return { error: "config", values };
  const ip = await visitorIp();
  const ipHash = hmac(formKey, ip);
  const langValue = String(form.get("lang") ?? "");
  const lang: Locale = isLocale(langValue) ? langValue : defaultLocale;
  const v = parsed.value;
  const codeStep = (extra: Partial<Extract<BookingFormState, { step: "code" }>> = {}): BookingFormState => ({ step: "code", email: v.email, values, ...extra });

  if (intent === "verify") {
    const code = parseCode(form.get("code"));
    if (!code) return codeStep({ codeError: "format" });
    const { data: status, error } = await db.rpc("check_email_code", { form_key: formKey, email: v.email, code_hash: codeHash(formKey, v.email, code) });
    if (error) {
      console.error("[booking] code check failed:", error.code);
      return codeStep({ error: "generic" });
    }
    if (status !== "ok") return codeStep({ codeError: status === "locked" ? "locked" : status === "expired" ? "expired" : "wrong" });
    return save(db, formKey, ipHash, lang, v, values);
  }

  // "send" or "resend": anti-robot check (Cloudflare Turnstile, once its keys are set). A resend skips it
  // only when this address got a code in the last 10 minutes (the database says so, not the form).
  const resend = intent === "resend" && (await db.rpc("can_resend_email_code", { form_key: formKey, email: v.email })).data === true;
  if (!resend && !(await verifyTurnstile(form.get("cf-turnstile-response"), ip))) return { error: "captcha", values };
  const problem = await emailDomainProblem(v.email);
  if (problem) return { errors: { email: problem }, error: "check", values };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await db.rpc("create_email_code", { form_key: formKey, email: v.email, code_hash: codeHash(formKey, v.email, code), ip_hash: ipHash });
  if (error) {
    const m = error.message ?? "";
    const back = intent === "resend" ? codeStep : (e: FormError) => ({ error: e, values });
    if (m.includes("wait")) return intent === "resend" ? codeStep({ error: "wait" }) : codeStep();
    if (m.includes("too_many")) return back("codeTooMany");
    console.error("[booking] code create failed:", error.code);
    return back("generic");
  }
  const mail = codeMail(lang, code);
  if (!(await sendMail({ to: v.email, ...mail }))) return { error: "mail", values };
  return codeStep({ resent: intent === "resend" });
}

type Db = NonNullable<ReturnType<typeof publicClient>>;

async function save(db: Db, formKey: string, ipHash: string, lang: Locale, v: BookingInput, values: Record<string, string>): Promise<BookingFormState> {
  const { data, error } = await db.rpc("submit_booking_request", {
    p: { ...v, adults: String(v.adults), children: String(v.children), lang, consent: "true" },
    form_key: formKey,
    ip_hash: ipHash,
  });
  if (error || typeof data !== "string") {
    const m = error?.message ?? "";
    if (m.includes("email_unverified")) return { step: "code", email: v.email, values, codeError: "expired" };
    if (m.includes("too_many")) return { error: "tooMany", values };
    if (m.includes("program_unavailable")) return { error: "programGone", values };
    if (m.includes("invalid") || m.includes("consent")) return { error: "check", values };
    console.error("[booking] submit failed:", error?.code, m);
    return { error: "generic", values };
  }
  // Alerts after the response (never delay or break the request): phone notifications,
  // e-mail to the agency and the Direction accounts, the client's confirmation, and Telegram when configured.
  const reference = data;
  const summary: BookingSummary = { reference, service: v.service, program_title: v.program, from_place: v.from_place, to_place: v.to_place, travel_dates: v.travel_dates, adults: v.adults, children: v.children, lang };
  after(async () => {
    const { data: bosses } = await db.rpc("direction_emails", { form_key: formKey });
    const team = [...new Set([AGENCY.email, ...((bosses ?? []) as string[])].map((e) => e.toLowerCase()))];
    await Promise.allSettled([
      pushToBookingStaff(bookingPush(summary)),
      sendMail({ to: team, ...staffBookingMail(summary, staffUrl()) }),
      sendMail({ to: v.email, replyTo: AGENCY.email, ...confirmationMail(lang, v.full_name, summary) }),
      sendTelegram(bookingMessage(summary, staffUrl())),
    ]);
  });
  return { reference };
}
