/**
 * One-time Cloudflare Turnstile setup (anti-robot check of the booking form),
 * typed in YOUR terminal (never in a chat):
 *   npm run turnstile:setup
 *
 * Before: in the Cloudflare dashboard → Turnstile → Add widget, with the hostnames
 * localhost and goodfly.ma, mode "Managed". It gives a site key and a secret key.
 *
 * Checks the secret key with Cloudflare, then writes TURNSTILE_SITE_KEY and
 * TURNSTILE_SECRET_KEY to .env.local (readable by you only).
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ask, setLine } from "../lib/terminal.ts";

const ENV = fileURLToPath(new URL("../../.env.local", import.meta.url));
const KEY = /^0x[A-Za-z0-9_-]{16,}$/;

if (!process.stdin.isTTY) {
  console.error("Lancez cette commande dans un terminal (pas dans un chat) : npm run turnstile:setup");
  process.exit(1);
}

console.log("Configuration de l'anti-robot Cloudflare Turnstile. La clé secrète n'est jamais affichée.\n");
const siteKey = (await ask("Site key (commence par 0x) : ")).trim();
if (!KEY.test(siteKey)) {
  console.error("Ce n'est pas une site key Turnstile (elle commence par 0x).");
  process.exit(1);
}
const secret = (await ask("Secret key (commence par 0x) : ", true)).trim();
if (!KEY.test(secret)) {
  console.error("Ce n'est pas une secret key Turnstile (elle commence par 0x).");
  process.exit(1);
}
if (secret === siteKey) {
  console.error("La secret key est différente de la site key : copiez la deuxième clé.");
  process.exit(1);
}

// A fake token: Cloudflare then says whether the secret itself is valid.
const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
  method: "POST",
  body: new URLSearchParams({ secret, response: "setup-check" }),
  signal: AbortSignal.timeout(15000),
}).catch(() => null);
const json = res ? ((await res.json().catch(() => ({}))) as { "error-codes"?: string[] }) : null;
if (!json) {
  console.error("Cloudflare ne répond pas. Vérifiez la connexion Internet et réessayez.");
  process.exit(1);
}
if (json["error-codes"]?.includes("invalid-input-secret")) {
  console.error("Cloudflare refuse cette secret key. Copiez-la de nouveau depuis le tableau de bord Turnstile.");
  process.exit(1);
}

let env = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
env = setLine(env, "TURNSTILE_SITE_KEY", siteKey);
env = setLine(env, "TURNSTILE_SECRET_KEY", secret);
writeFileSync(ENV, env);
chmodSync(ENV, 0o600); // readable by you only

console.log("\nC'est prêt : l'anti-robot est activé sur le formulaire de réservation.");
console.log("Redémarrez le site (npm run dev) pour l'activer.");
