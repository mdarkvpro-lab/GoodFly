/**
 * One-time e-mail setup, typed in YOUR terminal (never in a chat):
 *   npm run mail:setup
 *
 * Before: on the agency's Gmail account, turn on 2-Step Verification, then create an
 * "app password" (Google Account → Security → App passwords). It is 16 letters.
 *
 * 1. Asks for the Gmail address and the app password (hidden input).
 * 2. Checks them with Gmail, writes MAIL_USER and MAIL_PASSWORD to .env.local
 *    (readable by you only) and sends a test e-mail to the same address.
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { ask, setLine } from "../lib/terminal.ts";

const ENV = fileURLToPath(new URL("../../.env.local", import.meta.url));

if (!process.stdin.isTTY) {
  console.error("Lancez cette commande dans un terminal (pas dans un chat) : npm run mail:setup");
  process.exit(1);
}

console.log("Configuration des e-mails GoodFly (Gmail). Le mot de passe n'est jamais affiché.\n");
console.log("Avant : sur le compte Gmail de l'agence, activez la « Validation en deux étapes »,");
console.log("puis créez un « Mot de passe d'application » : https://myaccount.google.com/apppasswords\n");

const user = ((await ask("Adresse Gmail [goodfly64@gmail.com] : ")).trim() || "goodfly64@gmail.com").toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) {
  console.error("Adresse e-mail invalide.");
  process.exit(1);
}
const password = (await ask("Mot de passe d'application (16 lettres) : ", true)).replace(/\s+/g, "");
if (!/^[a-z]{16}$/i.test(password)) {
  console.error("Ce n'est pas un mot de passe d'application Google (16 lettres, ex. « abcd efgh ijkl mnop »).");
  console.error("N'utilisez pas le mot de passe normal du compte.");
  process.exit(1);
}

const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass: password } });
try {
  await transport.verify();
} catch (e) {
  const code = (e as { responseCode?: number; code?: string }).responseCode ?? (e as { code?: string }).code;
  console.error(`Gmail refuse la connexion (${code ?? "erreur"}). Vérifiez l'adresse et le mot de passe d'application.`);
  process.exit(1);
}

let env = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
env = setLine(env, "MAIL_USER", user);
env = setLine(env, "MAIL_PASSWORD", password);
writeFileSync(ENV, env);
chmodSync(ENV, 0o600); // readable by you only

await transport.sendMail({
  from: { name: "GoodFly", address: user },
  to: user,
  subject: "GoodFly : les e-mails du site sont activés",
  text: "Ce message confirme que le site GoodFly peut envoyer des e-mails : codes de vérification aux clients, confirmations de demande et alertes à l'équipe.",
});
transport.close();
console.log(`\nC'est prêt : un e-mail de test a été envoyé à ${user}.`);
console.log("Redémarrez le site (npm run dev, ou npm run build puis npm run start) pour activer les e-mails.");
