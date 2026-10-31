import "server-only";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import type { ProfileRow } from "./stats";

/**
 * Data access layer for the Direction area. Every staff page and action goes through
 * requireDirection(): the JWT is verified (getClaims), then the profile must be an
 * active Direction account. Database RLS rules still apply to every query.
 */

export type StaffUser = { id: string; email: string; fullName: string; mustChangePassword: boolean };

export const staffPath = (lang: Locale, page = "") => `/${lang}/espace${page ? `/${page}` : ""}`;

export async function requireDirection(lang: Locale, opts: { allowPasswordChange?: boolean } = {}) {
  if (!supabaseConfigured()) redirect(`${staffPath(lang, "connexion")}?e=config`);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect(staffPath(lang, "connexion"));

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, disabled_at")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile || profile.role !== "direction" || profile.disabled_at) {
    await supabase.auth.signOut();
    redirect(`${staffPath(lang, "connexion")}?e=forbidden`);
  }

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const user: StaffUser = {
    id: profile.id,
    email: profile.email || String(claims.email ?? ""),
    fullName: profile.full_name,
    mustChangePassword: meta.must_change_password === true,
  };
  // First sign-in with a temporary password: change it before anything else.
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect(staffPath(lang, "mot-de-passe"));
  return { supabase, user };
}

export async function listProfiles(lang: Locale): Promise<ProfileRow[]> {
  const { supabase } = await requireDirection(lang);
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, disabled_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProfileRow[];
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
