"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { PERMISSIONS } from "@/lib/staff/access";
import { requireDirection, staffPath } from "@/lib/staff/dal";

/**
 * Employees (Direction only): create, set permissions, and the two-boss removal flow.
 * Every rule is enforced again by the database functions and the Edge Function.
 */

export type CreateEmployeeState =
  | { error: "email" | "name" | "exists" | "generic" | "config"; email?: string; fullName?: string }
  | { created: { email: string; password: string; fullName: string } }
  | undefined;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const langOf = (form: FormData): Locale => {
  const v = String(form.get("lang") ?? "");
  return isLocale(v) ? v : defaultLocale;
};

const permissionsOf = (form: FormData) =>
  [...new Set(form.getAll("permissions").map(String))].filter((p) => (PERMISSIONS as readonly string[]).includes(p));

/** Creates the account through the create-employee Edge Function (the secret key stays in Supabase). */
export async function createEmployee(_prev: CreateEmployeeState, form: FormData): Promise<CreateEmployeeState> {
  const lang = langOf(form);
  const { supabase } = await requireDirection(lang);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const fullName = String(form.get("fullName") ?? "").trim().slice(0, 120);
  if (!EMAIL.test(email) || email.length > 254) return { error: "email", email, fullName };
  if (!fullName) return { error: "name", email, fullName };

  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return { error: "config", email, fullName };

  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/create-employee`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ email, fullName, permissions: permissionsOf(form) }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { error: "generic", email, fullName };
  }
  const body = (await res.json().catch(() => ({}))) as { email?: string; password?: string; error?: string };
  if (!res.ok || !body.password) {
    const error = body.error === "exists" ? "exists" : body.error === "email" ? "email" : body.error === "name" ? "name" : "generic";
    return { error, email, fullName };
  }
  // Shown once on screen, never stored by the site, never put in a URL.
  refresh(); // the new employee appears in the team list right away
  return { created: { email: body.email ?? email, password: body.password, fullName } };
}

export type ResetPasswordState = { password: string } | { error: "limit" | "notEmployee" | "generic" | "config" } | undefined;

/** Forgotten password: a new temporary password for an employee (max 10 per 30 days, enforced by the database). */
export async function resetEmployeePassword(_prev: ResetPasswordState, form: FormData): Promise<ResetPasswordState> {
  const lang = langOf(form);
  const { supabase } = await requireDirection(lang);
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return { error: "generic" };
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return { error: "config" };
  try {
    const res = await fetch(`${url}/functions/v1/reset-employee-password`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ id }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { password?: string; error?: string };
    if (res.ok && body.password) {
      refresh(); // updates the "resets left" counters
      return { password: body.password }; // shown once, never stored by the site
    }
    return { error: body.error === "limit" ? "limit" : body.error === "notEmployee" ? "notEmployee" : "generic" };
  } catch {
    return { error: "generic" };
  }
}

function errorKey(message: string) {
  if (/already pending/.test(message)) return "pending";
  if (/30-day/.test(message)) return "window";
  if (/only removed employees/.test(message)) return "notRemoved";
  if (/other Direction account/.test(message)) return "otherBoss";
  if (/active employees/.test(message)) return "notEmployee";
  if (/42501|only|forbidden/.test(message)) return "forbidden";
  return "generic";
}

async function run(form: FormData, call: (lang: Locale) => Promise<{ error: { message: string } | null }>, ok: string) {
  const lang = langOf(form);
  const back = staffPath(lang, "employes");
  const { error } = await call(lang);
  redirect(`${back}?${error ? `e=${errorKey(error.message)}` : `m=${ok}`}`);
}

export async function savePermissions(form: FormData) {
  const id = String(form.get("id") ?? "");
  await run(
    form,
    async (lang) => {
      const { supabase } = await requireDirection(lang);
      if (!UUID.test(id)) return { error: { message: "generic" } };
      return supabase.rpc("set_employee_permissions", { employee: id, perms: permissionsOf(form) });
    },
    "permissions",
  );
}

export async function requestRemoval(form: FormData) {
  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim().slice(0, 500);
  await run(
    form,
    async (lang) => {
      const { supabase } = await requireDirection(lang);
      if (!UUID.test(id)) return { error: { message: "generic" } };
      return supabase.rpc("request_employee_removal", { employee: id, reason });
    },
    "removalRequested",
  );
}

export async function decideRemoval(form: FormData) {
  const id = String(form.get("request") ?? "");
  const approve = String(form.get("decision") ?? "") === "approve";
  const restore = form.get("kind") === "restore";
  await run(
    form,
    async (lang) => {
      const { supabase } = await requireDirection(lang);
      if (!UUID.test(id)) return { error: { message: "generic" } };
      return supabase.rpc("decide_employee_removal", { request: id, approve });
    },
    restore ? (approve ? "restoreApproved" : "restoreRejected") : approve ? "removalApproved" : "removalRejected",
  );
}

export async function cancelRemoval(form: FormData) {
  const id = String(form.get("request") ?? "");
  await run(
    form,
    async (lang) => {
      const { supabase } = await requireDirection(lang);
      if (!UUID.test(id)) return { error: { message: "generic" } };
      return supabase.rpc("cancel_employee_removal", { request: id });
    },
    "removalCancelled",
  );
}

/** Bring a removed employee back: like a removal, the other Direction account must approve. */
export async function requestRestore(form: FormData) {
  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim().slice(0, 500);
  await run(
    form,
    async (lang) => {
      const { supabase } = await requireDirection(lang);
      if (!UUID.test(id)) return { error: { message: "generic" } };
      return supabase.rpc("request_employee_restore", { employee: id, reason });
    },
    "restoreRequested",
  );
}
