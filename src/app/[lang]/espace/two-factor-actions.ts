"use server";

import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { backupCodeHash, newBackupCodes } from "@/lib/staff/backup-codes";
import { hasTotp, requireStaff, staffHome, staffPath } from "@/lib/staff/dal";

/**
 * Two-factor authentication for the staff area (authenticator app, 6-digit codes).
 * The 2FA steps run after the password alone; every other staff page needs them done.
 */

const langOf = (v: unknown): Locale => {
  const s = String(v ?? "");
  return isLocale(s) ? s : defaultLocale;
};
const sixDigits = (v: unknown) => {
  const s = String(v ?? "")
    .replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf))
    .replace(/\s/g, "");
  return /^\d{6}$/.test(s) ? s : null;
};

type Supabase = Awaited<ReturnType<typeof requireStaff>>["supabase"];

/** New backup codes for the signed-in account (needs 2FA done): shown once, stored as hashes. */
async function makeBackupCodes(supabase: Supabase, userId: string): Promise<string[] | null> {
  const codes = newBackupCodes();
  const { error } = await supabase.rpc("set_backup_codes", { hashes: codes.map((c) => backupCodeHash(userId, c)) });
  return error ? null : codes;
}

export type EnrollStart = { factorId: string; qr: string; secret: string } | { error: "generic" | "already" };

/** Step 1 of the setup: a new authenticator secret (QR code). Any unfinished setup is replaced. */
export async function startEnrollment(langValue: string): Promise<EnrollStart> {
  const lang = langOf(langValue);
  const { supabase } = await requireStaff(lang, { mfaStep: true });
  if (await hasTotp(supabase)) return { error: "already" };
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `GoodFly ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return { error: "generic" };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export type EnrollState = { error?: "code" | "wrong" | "generic"; codes?: string[] } | undefined;

/** Step 2: the first code from the app confirms the setup; the 10 backup codes are made. */
export async function confirmEnrollment(_prev: EnrollState, form: FormData): Promise<EnrollState> {
  const lang = langOf(form.get("lang"));
  const { supabase } = await requireStaff(lang, { mfaStep: true });
  const code = sixDigits(form.get("code"));
  const factorId = String(form.get("factorId") ?? "");
  if (!code) return { error: "code" };
  if (!/^[0-9a-f-]{36}$/.test(factorId)) return { error: "generic" };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: "wrong" };
  const { data } = await supabase.auth.getUser();
  const codes = data.user ? await makeBackupCodes(supabase, data.user.id) : null;
  return codes ? { codes } : { error: "generic" };
}

export type ChallengeState = { error?: "code" | "wrong" | "rate" | "generic" } | undefined;

/** Each sign-in: the 6-digit code of the app. */
export async function verifyTwoFactor(_prev: ChallengeState, form: FormData): Promise<ChallengeState> {
  const lang = langOf(form.get("lang"));
  const { supabase, user } = await requireStaff(lang, { mfaStep: true });
  const code = sixDigits(form.get("code"));
  if (!code) return { error: "code" };
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.find((f) => f.status === "verified");
  if (!factor) redirect(staffPath(lang, "activer-2fa"));
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: error.status === 429 ? "rate" : "wrong" };
  redirect(staffPath(lang, staffHome(user)));
}

export type RecoveryState = { error?: "format" | "wrong" | "tooMany" | "generic" } | undefined;

/** Lost phone: one backup code removes the 2FA (server side), then the setup starts again. */
export async function recoverWithBackupCode(_prev: RecoveryState, form: FormData): Promise<RecoveryState> {
  const lang = langOf(form.get("lang"));
  const { supabase } = await requireStaff(lang, { mfaStep: true });
  const code = String(form.get("code") ?? "").slice(0, 40);
  if (code.replace(/[^A-Za-z0-9]/g, "").length !== 10) return { error: "format" };
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return { error: "generic" };
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/mfa-recovery`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ code }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { error: "generic" };
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { error: body.error === "wrong" ? "wrong" : body.error === "tooMany" ? "tooMany" : body.error === "format" ? "format" : "generic" };
  // The reset refused every token issued before it: take a fresh one, then set up the new phone.
  await supabase.auth.refreshSession();
  redirect(staffPath(lang, "activer-2fa"));
}

export type CodesState = { error?: "generic"; codes?: string[] } | undefined;

/** "Mon compte": replace the backup codes (the old ones stop working). */
export async function regenerateBackupCodes(_prev: CodesState, form: FormData): Promise<CodesState> {
  const lang = langOf(form.get("lang"));
  const { supabase, user } = await requireStaff(lang);
  const codes = await makeBackupCodes(supabase, user.id);
  return codes ? { codes } : { error: "generic" };
}

/** "Mon compte": sign out every other browser and phone of this account. */
export async function signOutOtherDevices(form: FormData) {
  const lang = langOf(form.get("lang"));
  const { supabase } = await requireStaff(lang);
  const { error } = await supabase.auth.signOut({ scope: "others" });
  redirect(`${staffPath(lang, "mon-compte")}?${error ? "e=generic" : "m=othersSignedOut"}`);
}
