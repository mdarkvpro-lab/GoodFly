"use server";

import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { BOOKING_STATUSES } from "@/lib/bookings/validate";
import { requireDirection, requireStaff, staffPath } from "@/lib/staff/dal";

/** Follow-up of booking requests. The database functions check the same rules and write the journal. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const langOf = (form: FormData): Locale => {
  const v = String(form.get("lang") ?? "");
  return isLocale(v) ? v : defaultLocale;
};

/** Keep the list filter after saving (only known statuses). */
const backTo = (lang: Locale, form: FormData, q: string) => {
  const f = String(form.get("filter") ?? "");
  const filter = (BOOKING_STATUSES as readonly string[]).includes(f) ? `&statut=${f}` : "";
  return `${staffPath(lang, "reservations")}?${q}${filter}`;
};

export async function updateBooking(form: FormData) {
  const lang = langOf(form);
  const { supabase } = await requireStaff(lang, { permission: "bookings.manage" });
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  const note = String(form.get("note") ?? "").replace(/\r\n/g, "\n").trim();
  if (!UUID.test(id) || !(BOOKING_STATUSES as readonly string[]).includes(status) || note.length > 1000) redirect(backTo(lang, form, "e=generic"));
  const { error } = await supabase.rpc("update_booking_request", { request: id, new_status: status, note });
  redirect(backTo(lang, form, error ? "e=generic" : "m=bookingSaved"));
}

/** Direction only: erase a request (e.g. the client asks to delete their data). */
export async function deleteBooking(form: FormData) {
  const lang = langOf(form);
  const { supabase } = await requireDirection(lang);
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) redirect(backTo(lang, form, "e=generic"));
  const { error } = await supabase.rpc("delete_booking_request", { request: id });
  redirect(backTo(lang, form, error ? "e=generic" : "m=bookingDeleted"));
}
