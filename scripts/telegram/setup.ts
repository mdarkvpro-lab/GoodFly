/**
 * One-time Telegram setup, typed in YOUR terminal (never in a chat):
 *   npm run telegram:setup
 *
 * 1. Asks for the bot token with hidden input and checks it with Telegram (getMe).
 * 2. You add the bot to the agency's private group and send a message there.
 * 3. Finds the group, writes TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to .env.local
 *    (readable by you only) and sends a test message.
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ENV = fileURLToPath(new URL("../../.env.local", import.meta.url));

function ask(question: string, hidden = false): Promise<string> {
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
        if (c === "\u007f" || c === "\b") {
          if (value && !hidden) process.stdout.write("\b \b");
          value = value.slice(0, -1);
        } else {
          value += c;
          if (!hidden) process.stdout.write(c);
        }
      }
    };
    stdin.on("data", onData);
  });
}

function setLine(text: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  return re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
}

type Chat = { id: number; title?: string; type: string };

/** Telegram API call; the token is never printed, even in errors. */
async function api<T>(token: string, method: string, body?: object): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(`${method} : ${json.description ?? res.status}`);
  return json.result as T;
}

if (!process.stdin.isTTY) {
  console.error("Lancez cette commande dans un terminal (pas dans un chat) : npm run telegram:setup");
  process.exit(1);
}

console.log("Configuration des alertes Telegram GoodFly. Le token n'est jamais affiché.\n");
const token = (await ask("Token du bot (donné par @BotFather) : ", true)).trim();
if (!/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(token)) {
  console.error("Ce n'est pas un token de bot Telegram valide (format 123456789:ABC…).");
  process.exit(1);
}

let bot: { username: string };
try {
  bot = await api<{ username: string }>(token, "getMe");
} catch (e) {
  console.error("Telegram refuse ce token :", (e as Error).message);
  process.exit(1);
}
console.log(`\nBot reconnu : @${bot.username}`);
console.log(`Maintenant, dans Telegram :`);
console.log(`  1. Ajoutez @${bot.username} au groupe privé de l'agence.`);
console.log(`  2. Écrivez dans ce groupe : /start@${bot.username}`);
await ask("Puis appuyez sur Entrée ici… ");

const updates = await api<{ message?: { chat: Chat }; my_chat_member?: { chat: Chat } }[]>(token, "getUpdates", {
  allowed_updates: ["message", "my_chat_member"],
});
const groups = new Map<number, Chat>();
for (const u of updates) {
  const chat = u.message?.chat ?? u.my_chat_member?.chat;
  if (chat && (chat.type === "group" || chat.type === "supergroup")) groups.set(chat.id, chat);
}
if (!groups.size) {
  console.error("Aucun groupe trouvé. Vérifiez que le bot est bien dans le groupe et réécrivez /start, puis relancez la commande.");
  process.exit(1);
}

const list = [...groups.values()];
list.forEach((g, i) => console.log(`  ${i + 1}. ${g.title ?? "(sans nom)"}`));
let chosen = list[0];
if (list.length > 1) {
  const n = Number((await ask("Numéro du groupe de l'agence : ")).trim());
  if (!list[n - 1]) {
    console.error("Choix invalide.");
    process.exit(1);
  }
  chosen = list[n - 1];
}

let env = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
env = setLine(env, "TELEGRAM_BOT_TOKEN", token);
env = setLine(env, "TELEGRAM_CHAT_ID", String(chosen.id));
writeFileSync(ENV, env);
chmodSync(ENV, 0o600); // readable by you only

await api(token, "sendMessage", {
  chat_id: chosen.id,
  text: "GoodFly : les nouvelles demandes de réservation arriveront ici (référence et voyage, sans les coordonnées du client).",
});
console.log(`\nC'est prêt : message de test envoyé dans « ${chosen.title ?? "le groupe"} ».`);
console.log("Redémarrez le site (npm run build puis npm run start) pour activer les alertes.");
