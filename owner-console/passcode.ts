/**
 * Creates the owner passcode hash for owner-console/.env.local.
 *   npm run owner:passcode
 * The passcode itself is never stored — only its scrypt hash.
 */
import { createInterface } from "node:readline/promises";
import { hashPasscode } from "./lib/auth.ts";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const a = await rl.question("Nouveau code propriétaire (12 caractères minimum) : ");
const b = await rl.question("Confirmez le code : ");
rl.close();
if (a !== b) {
  console.error("Les deux codes sont différents.");
  process.exit(1);
}
if (a.length < 12) {
  console.error("Le code doit faire au moins 12 caractères.");
  process.exit(1);
}
console.log(`\nAjoutez cette ligne dans owner-console/.env.local :\nOWNER_PASSCODE_HASH=${hashPasscode(a)}\n`);
