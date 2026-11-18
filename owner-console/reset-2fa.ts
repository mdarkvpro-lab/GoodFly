/**
 * Emergency 2FA reset (lost phone and no backup code left), for the OWNER only, in YOUR terminal:
 *   npm run owner:reset-2fa
 *
 * 1. Asks for the owner passcode (hidden; 3 tries) — the same scrypt hash as the owner console.
 * 2. Asks for the staff account's e-mail, then for it again to confirm.
 * 3. Removes the account's 2FA factors (Auth admin API), forgets its backup codes, refuses every
 *    token issued before now, ends all its sessions and writes the reset in the journal.
 *    At the next sign-in, the person sets up 2FA again on the new phone.
 * There is no website endpoint for this: it needs the secret key in owner-console/.env.local.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { ask } from "../scripts/lib/terminal.ts";
import { verifyPasscode } from "./lib/auth.ts";

const envFile = fileURLToPath(new URL("./.env.local", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

if (!process.stdin.isTTY) {
  console.error("Lancez cette commande dans un terminal (pas dans un chat) : npm run owner:reset-2fa");
  process.exit(1);
}
const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OWNER_PASSCODE_HASH"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Manquant dans owner-console/.env.local : ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Réinitialisation d'urgence de la double authentification (propriétaire uniquement).\n");

// 1. Strong owner check.
let ok = false;
for (let i = 0; i < 3 && !ok; i++) {
  ok = verifyPasscode(await ask("Code propriétaire : ", true), process.env.OWNER_PASSCODE_HASH!);
  if (!ok) console.error("Code incorrect.");
}
if (!ok) {
  console.error("Trop d'essais. Arrêt.");
  process.exit(1);
}

// 2. Which account, confirmed twice.
const email = (await ask("E-mail du compte à réinitialiser : ")).trim().toLowerCase();
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: profile, error: profileError } = await admin
  .from("profiles")
  .select("id, full_name, role")
  .eq("email", email)
  .maybeSingle();
if (profileError || !profile) {
  console.error("Aucun compte avec cet e-mail.");
  process.exit(1);
}
if (!["direction", "agent"].includes(profile.role)) {
  console.error("Seuls les comptes Direction et employés ont une double authentification à réinitialiser.");
  process.exit(1);
}
console.log(`\nCompte : ${profile.full_name || "(sans nom)"} — ${profile.role === "direction" ? "Direction" : "employé"}`);
if ((await ask("Retapez l'e-mail pour confirmer : ")).trim().toLowerCase() !== email) {
  console.error("Les e-mails ne correspondent pas. Rien n'a été changé.");
  process.exit(1);
}

// 3. Remove the factors, then reset (backup codes, older tokens, sessions, journal).
const { data: factors, error: listError } = await admin.auth.admin.mfa.listFactors({ userId: profile.id });
if (listError) {
  console.error("Impossible de lire la double authentification du compte. Rien n'a été changé.");
  process.exit(1);
}
for (const f of factors?.factors ?? []) {
  const { error } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: profile.id });
  if (error) {
    console.error("Impossible de retirer la double authentification. Réessayez.");
    process.exit(1);
  }
}
const { error: resetError } = await admin.rpc("mfa_reset", { account: profile.id, via: "owner_cli" });
if (resetError) {
  console.error("La double authentification est retirée, mais la fermeture des sessions a échoué. Relancez la commande.");
  process.exit(1);
}

console.log(`\nC'est fait : ${(factors?.factors ?? []).length} application(s) retirée(s), codes de secours effacés, toutes les sessions fermées.`);
console.log("À sa prochaine connexion, la personne réactivera la double authentification sur son nouveau téléphone.");
