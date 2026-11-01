"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { parseBooking, type BookingErrors } from "@/lib/bookings/validate";
import { verifyTurnstile } from "@/lib/bookings/turnstile";
import { bookingMessage } from "@/lib/notify/booking-message";
import { sendTelegram } from "@/lib/notify/telegram";
import { publicClient } from "@/lib/programs/data";

export type BookingFormState =
  | { reference: string }
  | { errors?: BookingErrors; error?: "check" | "tooMany" | "programGone" | "generic" | "config" | "captcha"; values: Record<string, string> }
  | undefined;

const FIELDS = ["full_name", "phone", "email", "from_place", "to_place", "travel_dates", "adults", "children", "message", "program"] as const;
const echo = (form: FormData) => Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? "").slice(0, 1000)]));

/**
 * The visitor's address, keyed-hashed (never stored in clear). The first x-forwarded-for entry
 * is set by the hosting platform's proxy; without a proxy it is only as trustworthy as the client.
 */
async function visitorIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim().slice(0, 64);
}

/** Link to the staff page for the Telegram alert, only from configuration (never from the request's Host). */
function staffUrl() {
  const site = process.env.SITE_URL;
  return site && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(site) ? `${site}/fr/espace/reservations?statut=new` : undefined;
}

/** A visitor's booking request. Stored through submit_booking_request() (the database re-checks everything). */
export async function submitBooking(_prev: BookingFormState, form: FormData): Promise<BookingFormState> {
  const values = echo(form);
  // Hidden field humans never fill: silently refuse bots.
  if (String(form.get("website") ?? "") !== "") return { error: "generic", values };

  const parsed = parseBooking((k) => form.get(k));
  if (!parsed.ok) return { errors: parsed.errors, error: "check", values };

  // Server-only key: proves the request came through this form (the database refuses others).
  const formKey = process.env.BOOKING_FORM_KEY;
  const db = publicClient();
  if (!db || !formKey) return { error: "config", values };
  const ip = await visitorIp();
  // Anti-robot check (Cloudflare Turnstile), active once its keys are configured.
  if (!(await verifyTurnstile(form.get("cf-turnstile-response"), ip))) return { error: "captcha", values };
  const langValue = String(form.get("lang") ?? "");
  const lang = isLocale(langValue) ? langValue : defaultLocale;
  const v = parsed.value;

  const { data, error } = await db.rpc("submit_booking_request", {
    p: { ...v, adults: String(v.adults), children: String(v.children), lang, consent: "true" },
    form_key: formKey,
    ip_hash: createHmac("sha256", formKey).update(ip).digest("hex"),
  });
  if (error || typeof data !== "string") {
    const m = error?.message ?? "";
    if (m.includes("too_many")) return { error: "tooMany", values };
    if (m.includes("program_unavailable")) return { error: "programGone", values };
    if (m.includes("invalid") || m.includes("consent")) return { error: "check", values };
    console.error("[booking] submit failed:", error?.code, m);
    return { error: "generic", values };
  }
  // Alert the agency's Telegram group after the response (never delays or breaks the request).
  const reference = data;
  after(() =>
    sendTelegram(
      bookingMessage(
        { reference, program_title: v.program, from_place: v.from_place, to_place: v.to_place, travel_dates: v.travel_dates, adults: v.adults, children: v.children, lang },
        staffUrl(),
      ),
    ),
  );
  return { reference };
}
