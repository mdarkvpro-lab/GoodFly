import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { Locale } from "@/i18n/config";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { can, PERMISSIONS, staffHome, type Permission, type StaffUser } from "./access";
import type { BookingStatus } from "@/lib/bookings/validate";
import type { ProfileRow } from "./stats";

/**
 * Data access layer for the staff area (Direction and employees). Every staff page and action
 * goes through requireStaff(): the JWT is verified (getClaims), then the profile must be an
 * active Direction or employee account with the needed permission. RLS still applies to every query.
 */

export { can, staffHome, type Permission, type StaffUser };

export const staffPath = (lang: Locale, page = "") => `/${lang}/espace${page ? `/${page}` : ""}`;

type Options = { permission?: Permission; directionOnly?: boolean; allowPasswordChange?: boolean };

/** One session + profile read per request, however many components ask for it. */
const loadSession = cache(async () => {
  // Staff sessions are always read at request time, never in the prerendered App Shell
  // (getClaims compares Date.now() with the token's expiry).
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { supabase, claims: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, disabled_at, permissions, must_change_password")
    .eq("id", claims.sub)
    .maybeSingle();
  return { supabase, claims, profile };
});

export async function requireStaff(lang: Locale, opts: Options = {}) {
  if (!supabaseConfigured()) redirect(`${staffPath(lang, "connexion")}?e=config`);
  const { supabase, claims, profile } = await loadSession();
  if (!claims) redirect(staffPath(lang, "connexion"));

  if (!profile || (profile.role !== "direction" && profile.role !== "agent") || profile.disabled_at) {
    await supabase.auth.signOut();
    redirect(`${staffPath(lang, "connexion")}?e=forbidden`);
  }

  const user: StaffUser = {
    id: profile.id,
    email: profile.email || String(claims.email ?? ""),
    fullName: profile.full_name,
    role: profile.role,
    permissions: ((profile.permissions ?? []) as string[]).filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(p)),
    mustChangePassword: profile.must_change_password === true,
  };
  // First sign-in with a temporary password: change it before anything else.
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect(staffPath(lang, "mot-de-passe"));
  // Pages an account may not use send it to its own home page instead.
  if ((opts.directionOnly && user.role !== "direction") || (opts.permission && !can(user, opts.permission))) {
    redirect(staffPath(lang, staffHome(user)));
  }
  return { supabase, user };
}

export const requireDirection = (lang: Locale, opts: { allowPasswordChange?: boolean } = {}) =>
  requireStaff(lang, { ...opts, directionOnly: true });

/** Staff accounts (Direction and employees), for the Employés page and the journal. Direction only. */
export async function listProfiles(lang: Locale): Promise<ProfileRow[]> {
  const { supabase } = await requireDirection(lang);
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, disabled_at, created_at, permissions")
    .in("role", ["direction", "agent"])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProfileRow[];
}

/** Dates only (no names or e-mails) for the dashboard; needs reports.view. */
export async function listStatsRows(lang: Locale): Promise<ProfileRow[]> {
  const { supabase } = await requireStaff(lang, { permission: "reports.view" });
  const { data, error } = await supabase.rpc("staff_profile_stats");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Pick<ProfileRow, "role" | "created_at" | "disabled_at">[]).map((r, i) => ({
    id: String(i),
    full_name: "",
    email: "",
    ...r,
  }));
}

export type AuditRow = { id: number; actor: string | null; action: string; target: string | null; details: Record<string, unknown>; created_at: string };

export async function listAudit(lang: Locale, limit = 100): Promise<AuditRow[]> {
  const { supabase } = await requireDirection(lang);
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, actor, action, target, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditRow[];
}

export type RemovalRequest = {
  id: string;
  kind: "remove" | "restore";
  employee: string;
  requested_by: string | null;
  reason: string;
  created_at: string;
};

export async function listPendingRemovals(lang: Locale): Promise<RemovalRequest[]> {
  const { supabase } = await requireDirection(lang);
  const { data, error } = await supabase
    .from("employee_removal_requests")
    .select("id, kind, employee, requested_by, reason, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RemovalRequest[];
}

export type StaffProgram = {
  id: string;
  slug: string;
  status: "draft" | "published" | "archived";
  title_fr: string;
  title_ar: string;
  summary_fr: string;
  summary_ar: string;
  description_fr: string;
  description_ar: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  price_from_mad: number | null;
  image_path: string | null;
  updated_at: string;
};

const PROGRAM_COLUMNS =
  "id, slug, status, title_fr, title_ar, summary_fr, summary_ar, description_fr, description_ar, destination, start_date, end_date, duration_days, price_from_mad, image_path, updated_at";

export async function listStaffPrograms(lang: Locale): Promise<StaffProgram[]> {
  const { supabase } = await requireStaff(lang, { permission: "programs.manage" });
  const { data, error } = await supabase.from("programs").select(PROGRAM_COLUMNS).order("updated_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffProgram[];
}

export async function getStaffProgram(lang: Locale, id: string): Promise<StaffProgram | null> {
  const { supabase } = await requireStaff(lang, { permission: "programs.manage" });
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await supabase.from("programs").select(PROGRAM_COLUMNS).eq("id", id).maybeSingle();
  return (data as StaffProgram | null) ?? null;
}

export type StaffBooking = {
  id: string;
  reference: string;
  program_title: string;
  program_id: string | null;
  full_name: string;
  phone: string;
  email: string;
  from_place: string;
  to_place: string;
  travel_dates: string;
  adults: number;
  children: number;
  message: string;
  lang: string;
  status: BookingStatus;
  service: "" | "flight" | "stay" | "visa";
  staff_note: string;
  handled_by: string | null;
  created_at: string;
  updated_at: string;
};

const BOOKING_COLUMNS =
  "id, reference, program_title, program_id, full_name, phone, email, from_place, to_place, travel_dates, adults, children, message, lang, status, service, staff_note, handled_by, created_at, updated_at";

/** Booking requests, newest first (needs bookings.manage; RLS enforces the same). */
export async function listBookings(lang: Locale, status?: BookingStatus): Promise<StaffBooking[]> {
  const { supabase } = await requireStaff(lang, { permission: "bookings.manage" });
  let query = supabase.from("booking_requests").select(BOOKING_COLUMNS);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffBooking[];
}

/** Requests still waiting for a first call (0 when the account cannot see bookings). */
export async function countNewBookings(lang: Locale): Promise<number> {
  const { supabase, user } = await requireStaff(lang, { allowPasswordChange: true });
  if (!can(user, "bookings.manage")) return 0;
  const { count } = await supabase.from("booking_requests").select("id", { count: "exact", head: true }).eq("status", "new");
  return count ?? 0;
}

/** Names of staff accounts for "handled by" (Direction sees all; others only themselves). */
export async function staffNames(lang: Locale): Promise<Map<string, string>> {
  const { supabase, user } = await requireStaff(lang, { permission: "bookings.manage" });
  const map = new Map<string, string>([[user.id, user.fullName || user.email]]);
  if (user.role === "direction") {
    const { data } = await supabase.from("profiles").select("id, full_name, email").in("role", ["direction", "agent"]);
    for (const r of data ?? []) map.set(r.id, r.full_name || r.email);
  }
  return map;
}

/** Password resets per employee over the last 30 days (Direction only), for the "10 per 30 days" limit. */
export async function recentPasswordResets(lang: Locale): Promise<Map<string, number>> {
  const { supabase } = await requireDirection(lang);
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase.from("password_resets").select("target").gt("created_at", since);
  if (error) throw new Error(error.message);
  const map = new Map<string, number>();
  for (const r of data ?? []) map.set(r.target, (map.get(r.target) ?? 0) + 1);
  return map;
}

/** Booking dates and statuses only (no client details) for the dashboard; needs reports.view. */
export async function listBookingStats(lang: Locale): Promise<{ created_at: string; status: string }[]> {
  const { supabase } = await requireStaff(lang, { permission: "reports.view" });
  const { data, error } = await supabase.rpc("staff_booking_stats");
  if (error) throw new Error(error.message);
  return (data ?? []) as { created_at: string; status: string }[];
}

export type StaffRequest = {
  id: string;
  kind: "remove" | "restore";
  status: "pending" | "approved" | "rejected" | "cancelled";
  employee: string;
  requested_by: string | null;
  decided_by: string | null;
  reason: string;
  created_at: string;
  decided_at: string | null;
};

/** Request time (staff pages are always rendered at request time). */
export const requestNow = () => Date.now();

/** Direction notifications: every pending request, plus decisions of the last 90 days, newest first. */
export async function listStaffRequests(lang: Locale): Promise<StaffRequest[]> {
  const { supabase } = await requireDirection(lang);
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("employee_removal_requests")
    .select("id, kind, status, employee, requested_by, decided_by, reason, created_at, decided_at")
    .or(`status.eq.pending,created_at.gt.${since}`)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffRequest[];
}

/** Requests from the other Direction account waiting for this account's decision (0 for employees). */
export async function countAwaitingDecision(lang: Locale): Promise<number> {
  const { supabase, user } = await requireStaff(lang, { allowPasswordChange: true });
  if (user.role !== "direction") return 0;
  const { count } = await supabase
    .from("employee_removal_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .neq("requested_by", user.id);
  return count ?? 0;
}
