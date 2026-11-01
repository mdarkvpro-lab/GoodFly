"use server";

import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { requireStaff, staffHome, staffPath } from "@/lib/staff/dal";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

export type FormState = { error?: string; email?: string; as?: "agent" | "direction" } | undefined;

const MIN_PASSWORD = 12;

const langOf = (form: FormData): Locale => {
  const v = String(form.get("lang") ?? "");
  return isLocale(v) ? v : defaultLocale;
};

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const lang = langOf(form);
  if (!supabaseConfigured()) return { error: "config" };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  // The tab chosen on the login page: an employee or a Direction account.
  const as = form.get("as") === "direction" ? "direction" : "agent";
  if (!email || !password) return { error: "credentials", email, as };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: error?.status === 429 ? "rate" : "credentials", email, as };

  // Only active Direction and employee accounts may enter this area.
  const { data: profile } = await supabase.from("profiles").select("role, disabled_at, permissions").eq("id", data.user.id).maybeSingle();
  if (!profile || (profile.role !== "direction" && profile.role !== "agent") || profile.disabled_at) {
    await supabase.auth.signOut();
    return { error: "forbidden", email, as };
  }
  // Wrong tab: say which one to use (the password was right, so this reveals nothing to a stranger).
  if (profile.role !== as) {
    await supabase.auth.signOut();
    return { error: profile.role === "direction" ? "useDirection" : "useEmployee", email, as };
  }
  redirect(staffPath(lang, staffHome({ role: profile.role, permissions: profile.permissions ?? [] })));
}

export async function signOut(form: FormData) {
  const lang = langOf(form);
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(staffPath(lang, "connexion"));
}

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const lang = langOf(form);
  const { supabase, user } = await requireStaff(lang, { allowPasswordChange: true });
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < MIN_PASSWORD) return { error: "short" };
  if (password !== confirm) return { error: "mismatch" };
  const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
  if (error) return { error: error.code === "same_password" ? "same" : error.code === "weak_password" ? "weak" : "generic" };
  // The "temporary password" flag is read from the session token: get a fresh token now,
  // otherwise the old one (still flagged) sends the user back to this page until it expires.
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    await supabase.auth.signOut();
    redirect(`${staffPath(lang, "connexion")}?e=passwordChanged`);
  }
  redirect(`${staffPath(lang, staffHome(user))}?m=password`);
}

export async function updateOwnName(form: FormData) {
  const lang = langOf(form);
  const { supabase, user } = await requireStaff(lang);
  const fullName = String(form.get("fullName") ?? "").trim().slice(0, 120);
  if (!fullName) redirect(`${staffPath(lang, "mon-compte")}?e=name`);
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
  redirect(`${staffPath(lang, "mon-compte")}?${error ? "e=generic" : "m=name"}`);
}

/**
 * Deactivate / restore a client, restore a removed employee, or hire a client as an employee.
 * Removing an employee goes through a removal request (see employes/actions.ts). The database refuses anything else.
 */
