"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { requireStaff, staffPath } from "@/lib/staff/dal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LISTS = ["pending", "approved", "rejected", "invited"];

/** Publish or withdraw a client review. The database checks the permission and writes the journal. */
export async function moderateReview(form: FormData) {
  const v = String(form.get("lang") ?? "");
  const lang: Locale = isLocale(v) ? v : defaultLocale;
  const { supabase } = await requireStaff(lang, { permission: "bookings.manage" });
  const id = String(form.get("id") ?? "");
  const decision = String(form.get("decision") ?? "");
  const list = String(form.get("list") ?? "");
  const back = (q: string) => `${staffPath(lang, "avis")}?${q}${LISTS.includes(list) ? `&liste=${list}` : ""}`;
  if (!UUID.test(id) || (decision !== "approved" && decision !== "rejected")) redirect(back("e=generic"));
  const { error } = await supabase.rpc("moderate_review", { review: id, decision });
  if (!error) updateTag("reviews");
  redirect(back(error ? "e=generic" : decision === "approved" ? "m=reviewApproved" : "m=reviewRejected"));
}
