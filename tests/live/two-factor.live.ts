// Live 2FA test against the REAL Supabase project: creates a temporary employee with the owner's
// secret key (owner-console/.env.local, never printed), runs setup, sign-in, backup-code recovery and
// the owner reset in a real browser, then deletes the account.  npm run build && npm run test:2fa-live
import { createHmac, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
const env: Record<string, string> = {};
for (const line of readFileSync("owner-console/.env.local", "utf8").split("\n")) { const m = /^([A-Z_]+)=(.*)$/.exec(line.trim()); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let fails = 0;
const log = (ok: boolean, what: string, info = "") => { if (!ok) fails++; console.log(ok ? "  ✓" : "  ✘", what, ok ? "" : info); };
function totp(secret: string) { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const c of secret.toUpperCase()) bits += a.indexOf(c).toString(2).padStart(5, "0"); const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2))); const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = createHmac("sha1", key).update(ctr).digest(); const o = h[h.length - 1] & 0xf; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }
const nextWindow = () => new Promise((r) => setTimeout(r, 30000 - (Date.now() % 30000) + 1500));
const email = `test.2fa.${Date.now()}@goodfly-test.example`; const password = randomBytes(18).toString("base64url");
const { data: c } = await admin.auth.admin.createUser({ email, password, email_confirm: true }); const uid = c.user!.id;
await admin.from("profiles").update({ role: "agent", full_name: "Test 2FA", permissions: ["bookings.manage"] }).eq("id", uid);
const server = spawn("npx", ["next", "start", "-p", "3100"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch("http://localhost:3100/fr")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }
const b = await chromium.launch();
const login = async (p: Page) => {
  await p.goto("http://localhost:3100/fr/espace/connexion", { waitUntil: "networkidle" });
  await p.getByLabel("E-mail").fill(email); await p.getByLabel("Mot de passe").fill(password);
  await p.getByRole("button", { name: "Se connecter" }).click();
  try { await p.waitForURL(/espace\/(activer-2fa|verification)/, { timeout: 20000 }); }
  catch { throw new Error(`login stuck at ${p.url()} alerts=${JSON.stringify(await p.getByRole("alert").allTextContents())}`); }
};
const alerts = (p: Page) => p.getByRole("main").getByRole("alert").allTextContents();
try {
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await login(p);
  await p.getByRole("button", { name: "Commencer" }).click();
  const secret = (await p.locator("code").first().textContent({ timeout: 15000 }))!.trim();
  await p.locator('input[name="code"]:visible').fill(totp(secret)); await p.getByRole("button", { name: "Activer" }).click();
  await p.locator("ol li").first().waitFor({ timeout: 15000 });
  const backup = await p.locator("ol li").allTextContents();
  log(backup.length === 10, "setup done, 10 backup codes");
  await p.getByRole("link", { name: /J'ai noté mes codes/ }).click(); await p.waitForURL(/espace\/reservations/, { timeout: 20000 });

  console.log("Lost phone: backup code");
  const other = await b.newContext(); const p2 = await other.newPage();
  await nextWindow(); await login(p2);
  await p2.locator('input[name="code"]:visible').fill(totp(secret)); await p2.getByRole("button", { name: "Vérifier" }).click();
  await p2.waitForURL(/espace\/reservations/, { timeout: 20000 });
  log(true, "a second browser is signed in with 2FA");
  await ctx.clearCookies(); await login(p);
  log(p.url().endsWith("/verification"), "first browser: password → code page", p.url());
  await p.getByRole("link", { name: /Utiliser un code de secours/ }).click(); await p.waitForURL(/code-secours/);
  await p.locator('input[name="code"]:visible').fill("ABCDE-23456"); await p.getByRole("button", { name: "Utiliser ce code" }).click(); await p.waitForTimeout(4000);
  log((await alerts(p)).some((t) => /incorrect ou déjà utilisé/.test(t)), "a wrong backup code is refused", JSON.stringify(await alerts(p)));
  await p.locator('input[name="code"]:visible').fill(backup[0].toLowerCase()); await p.getByRole("button", { name: "Utiliser ce code" }).click();
  try { await p.waitForURL(/activer-2fa/, { timeout: 20000 }); log(true, "a real backup code removes the 2FA and opens the setup again"); }
  catch { log(false, "backup code accepted", `${p.url()} ${JSON.stringify(await alerts(p))}`); throw new Error("stop"); }
  await p2.goto("http://localhost:3100/fr/espace/reservations"); await p2.waitForTimeout(2500);
  log(/connexion/.test(p2.url()), "the other browser was signed out by the recovery", p2.url());
  await p.getByRole("button", { name: "Commencer" }).click();
  const secret2 = (await p.locator("code").first().textContent({ timeout: 15000 }))!.trim();
  await p.locator('input[name="code"]:visible').fill(totp(secret2)); await p.getByRole("button", { name: "Activer" }).click();
  await p.locator("ol li").first().waitFor({ timeout: 15000 });
  log((await p.locator("ol li").count()) === 10 && secret2 !== secret, "a new phone is set up with new backup codes");
  await p.getByRole("link", { name: /J'ai noté mes codes/ }).click(); await p.waitForURL(/espace\/reservations/, { timeout: 20000 });

  console.log("Owner emergency reset (same steps as npm run owner:reset-2fa)");
  const { data: f } = await admin.auth.admin.mfa.listFactors({ userId: uid });
  for (const x of f?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ id: x.id, userId: uid });
  const { error: re } = await admin.rpc("mfa_reset", { account: uid, via: "owner_cli" });
  log(!re, "the reset runs with the secret key", re?.message);
  await p.goto("http://localhost:3100/fr/espace/reservations"); await p.waitForTimeout(2500);
  log(/connexion\?e=session/.test(p.url()), "the open session is closed at once", p.url());
  await login(p);
  log(p.url().endsWith("/activer-2fa"), "the next sign-in asks to set up 2FA again", p.url());
  const pub = createClient(env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { error: e1 } = await pub.rpc("mfa_reset", { account: uid, via: "owner_cli" });
  const { error: e2 } = await pub.rpc("consume_backup_code", { account: uid, code_hash: "a".repeat(64) });
  log(Boolean(e1) && Boolean(e2), "the public key cannot reset 2FA or spend codes");
  const { data: audit } = await admin.from("audit_log").select("action").eq("target", uid);
  log((audit ?? []).filter((a) => a.action === "mfa_reset").length === 2, "both resets are in the journal", JSON.stringify(audit));
} catch (e) { log(false, "test stopped", (e as Error).message); }
finally {
  await b.close(); process.kill(-server.pid!);
  const { error } = await admin.auth.admin.deleteUser(uid);
  console.log(error ? "  ✘ cleanup failed" : "  ✓ test account deleted");
  console.log(fails ? `${fails} FAILED` : "all passed");
}
process.exit(0);
