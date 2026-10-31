/**
 * One-time setup of owner-console/.env.local, typed in YOUR terminal (never in a chat):
 *   npm run owner:setup
 * Asks for the Supabase secret key and a new owner passcode with hidden input,
 * stores the key and only a scrypt hash of the passcode.
 */
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hashPasscode } from "./lib/auth.ts";

const ENV = fileURLToPath(new URL("./.env.local", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("./.env.example", import.meta.url));

/** Reads one line without echoing it. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (c === "\u0003") process.exit(130); // Ctrl+C
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

function setLine(text: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  return new RegExp(`^${key}=.*$`, "m").test(text) ? text.replace(new RegExp(`^${key}=.*$`, "m"), line) : `${text.trimEnd()}\n${line}\n`;
}

if (!process.stdin.isTTY) {
  console.error("Lancez cette commande dans un terminal (pas dans un chat) : npm run owner:setup");
  process.exit(1);
}

let env = existsSync(ENV) ? readFileSync(ENV, "utf8") : readFileSync(EXAMPLE, "utf8");

const key = (await askHidden("Clé secrète Supabase (sb_secret_… ou service_role) : ")).trim();
if (!/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key) && !/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(key)) {
  console.error("Ce n'est pas une clé secrète Supabase valide.");
  process.exit(1);
}

const a = await askHidden("Nouveau code propriétaire (12 caractères minimum) : ");
const b = await askHidden("Confirmez le code : ");
if (a !== b) {
  console.error("Les deux codes sont différents.");
  process.exit(1);
}
if (a.length < 12) {
  console.error("Le code doit faire au moins 12 caractères.");
  process.exit(1);
}

env = setLine(env, "SUPABASE_SERVICE_ROLE_KEY", key);
env = setLine(env, "OWNER_PASSCODE_HASH", hashPasscode(a));
writeFileSync(ENV, env);
chmodSync(ENV, 0o600); // readable by you only
console.log("C'est prêt. Lancez : npm run owner  puis ouvrez http://127.0.0.1:4000");
