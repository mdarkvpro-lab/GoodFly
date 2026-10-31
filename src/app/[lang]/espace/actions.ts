"use server";

import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { requireDirection, staffPath } from "@/lib/staff/dal";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

export type FormState = { error?: string; email?: string } | undefined;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
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
  if (!email || !password) return { error: "credentials", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: error?.status === 429 ? "rate" : "credentials", email };

  // Only active Direction accounts may enter this area.
  const { data: profile } = await supabase.from("profiles").select("role, disabled_at").eq("id", data.user.id).maybeSingle();
  if (!profile || profile.role !== "direction" || profile.disabled_at) {
    await supabase.auth.signOut();
    return { error: "forbidden", email };
  }
  redirect(staffPath(lang));
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
  const { supabase } = await requireDirection(lang, { allowPasswordChange: true });
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < MIN_PASSWORD) return { error: "short" };
  if (password !== confirm) return { error: "mismatch" };
  const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
  if (error) return { error: error.code === "same_password" ? "same" : error.code === "weak_password" ? "weak" : "generic" };
  redirect(`${staffPath(lang)}?m=password`);
}

export async function updateOwnName(form: FormData) {
  const lang = langOf(form);
  const { supabase, user } = await requireDirection(lang);
  const fullName = String(form.get("fullName") ?? "").trim().slice(0, 120);
  if (!fullName) redirect(`${staffPath(lang, "mon-compte")}?e=name`);
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
  redirect(`${staffPath(lang, "mon-compte")}?${error ? "e=generic" : "m=name"}`);
}

/** Deactivate / restore / change role of an agent or client. The database refuses anything else. */
export async function accountAction(form: FormData) {
  const lang = langOf(form);
  const { supabase } = await requireDirection(lang);
  const id = String(form.get("id") ?? "");
  const op = String(form.get("op") ?? "");
  const back = staffPath(lang, "comptes");
  if (!UUID.test(id)) redirect(`${back}?e=generic`);

  let error: { message: string } | null = null;
  let message = "";
  if (op === "deactivate") {
    ({ error } = await supabase.rpc("deactivate_account", { target: id }));
    message = "deactivated";
  } else if (op === "restore") {
    ({ error } = await supabase.rpc("restore_account", { target: id }));
    message = "restored";
  } else if (op === "role") {
    const role = String(form.get("role") ?? "");
    if (role !== "agent" && role !== "client") redirect(`${back}?e=generic`);
    const res = await supabase.from("profiles").update({ role }).eq("id", id).select("id");
    error = res.error ?? (res.data?.length ? null : { message: "forbidden" });
    message = "role";
  } else {
    redirect(`${back}?e=generic`);
  }

  if (error) {
    const key = /owner console|forbidden|42501/.test(error.message) ? "forbidden" : /30-day/.test(error.message) ? "window" : "generic";
    redirect(`${back}?e=${key}`);
  }
  redirect(`${back}?m=${message}`);
}
