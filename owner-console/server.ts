/**
 * GoodFly owner console — runs ONLY on the owner's computer (bound to 127.0.0.1).
 *   npm run owner          real Supabase project (needs owner-console/.env.local)
 *   npm run owner:demo     demo data, passcode "demo", nothing leaves the computer
 * Never deploy this folder: it uses the service-role key, which bypasses all database rules.
 */
import { readFileSync, existsSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { ActionError, OwnerActions } from "./lib/actions.ts";
import { clearedCookie, Guard, hashPasscode, readCookie, sameToken, sessionCookie, COOKIE } from "./lib/auth.ts";
import { MemoryStore } from "./lib/memoryStore.ts";
import { SupabaseStore, type AdminStore } from "./lib/store.ts";
import * as V from "./lib/views.ts";

const CSS = readFileSync(fileURLToPath(new URL("./public/app.css", import.meta.url)), "utf8");
// The site's own logo, served to the console pages (img-src 'self').
const LOGO = readFileSync(fileURLToPath(new URL("../public/brand/goodfly-logo.webp", import.meta.url)));
const MAX_BODY = 16 * 1024;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

type AppOptions = { store: AdminStore; guard: Guard; maxDirection: number; demo: boolean };

const SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "x-content-type-options": "nosniff",
  // "same-origin" (not "no-referrer"): browsers must keep sending our Origin on form posts.
  "referrer-policy": "same-origin",
  "cache-control": "no-store",
  "x-frame-options": "DENY",
};

function send(res: ServerResponse, status: number, body: string, headers: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

const redirect = (res: ServerResponse, to: string, headers: Record<string, string> = {}) =>
  send(res, 303, "", { location: to, ...headers });

function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("body too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(new URLSearchParams(Buffer.concat(chunks).toString("utf8"))));
    req.on("error", reject);
  });
}

export function createApp({ store, guard, maxDirection, demo }: AppOptions) {
  const actions = new OwnerActions(store, maxDirection);
  const flashes = new Map<string, V.Flash>();

  const page = (title: string, body: string, csrf?: string, nav?: "home" | "accounts" | "audit", token?: string) => {
    const flash = token ? (flashes.get(token) ?? null) : null;
    if (token) flashes.delete(token);
    return V.layout({ title, body, csrf, flash, storeLabel: store.label, nav });
  };

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    // 1. Loopback only (blocks LAN access and DNS rebinding).
    if (!guard.hostAllowed(req)) return send(res, 421, "Misdirected request", { "content-type": "text/plain" });

    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    const method = req.method ?? "GET";

    if (method === "GET" && path === "/app.css") {
      res.writeHead(200, { "content-type": "text/css; charset=utf-8", ...SECURITY_HEADERS });
      return res.end(CSS);
    }
    if (method === "GET" && path === "/logo.webp") {
      res.writeHead(200, { "content-type": "image/webp", ...SECURITY_HEADERS });
      return res.end(LOGO);
    }

    // 2. Every POST must come from our own pages.
    if (method === "POST" && !guard.originAllowed(req)) return send(res, 403, V.errorPage("Requête refusée (origine inconnue)."));

    if (path === "/login") {
      if (method === "GET") return send(res, 200, page("Connexion", V.loginPage({ demo })));
      if (method === "POST") {
        const form = await readForm(req);
        const result = guard.login(form.get("passcode") ?? "");
        if (result.ok) return redirect(res, "/", { "set-cookie": sessionCookie(result.token) });
        const minutes = Math.ceil(guard.lockRemainingMs() / 60_000);
        const error = result.locked ? `Trop d'essais. Réessayez dans ${minutes} minute(s).` : "Code incorrect.";
        return send(res, 401, page("Connexion", V.loginPage({ error, demo })));
      }
    }

    // 3. Everything else needs a live session.
    const session = guard.session(req);
    if (!session) return redirect(res, "/login");

    let form: URLSearchParams | null = null;
    if (method === "POST") {
      form = await readForm(req);
      if (!sameToken(form.get("csrf") ?? undefined, session.csrf)) return send(res, 403, V.errorPage("Jeton de sécurité invalide. Rechargez la page."));
    }

    const done = (to: string, flash: V.Flash) => {
      flashes.set(session.token, flash);
      return redirect(res, to);
    };
    const attempt = async (to: string, fn: () => Promise<V.Flash>) => {
      try {
        return done(to, await fn());
      } catch (e) {
        const text = e instanceof ActionError ? e.message : `Erreur : ${(e as Error).message}`;
        return done(to, { kind: "error", text });
      }
    };

    try {
      if (method === "POST" && path === "/logout") {
        guard.logout(readCookie(req, COOKIE));
        return redirect(res, "/login", { "set-cookie": clearedCookie });
      }

      if (method === "GET" && path === "/") {
        const [accounts, audit] = await Promise.all([store.listAccounts(), store.listAudit(20)]);
        return send(res, 200, page("Vue d'ensemble", V.overviewPage(accounts, audit, session.csrf, maxDirection), session.csrf, "home", session.token));
      }

      if (method === "GET" && path === "/accounts") {
        const accounts = await store.listAccounts();
        const filter = { role: url.searchParams.get("role") ?? "", q: url.searchParams.get("q") ?? "" };
        return send(res, 200, page("Comptes", V.accountsPage(accounts, filter), session.csrf, "accounts", session.token));
      }

      if (method === "GET" && path === "/audit") {
        const [accounts, audit] = await Promise.all([store.listAccounts(), store.listAudit(200)]);
        return send(res, 200, page("Journal", V.auditPage(audit, accounts), session.csrf, "audit", session.token));
      }

      const one = path.match(new RegExp(`^/accounts/(${UUID})(?:/(role|suspend|restore|delete|recovery))?$`));
      if (one) {
        const [, id, act] = one;
        if (method === "GET" && !act) {
          const acc = await store.getAccount(id);
          if (!acc || acc.role === "owner") return send(res, 404, page("Introuvable", V.errorPage("Compte introuvable ou protégé."), session.csrf));
          return send(res, 200, page(acc.fullName, V.accountPage(acc, session.csrf), session.csrf, "accounts", session.token));
        }
        if (method === "POST" && form && act) {
          const back = `/accounts/${id}`;
          if (act === "role") return attempt(back, async () => (await actions.setRole(id, form.get("role") ?? ""), { kind: "ok", text: "Rôle mis à jour." }));
          if (act === "suspend") return attempt(back, async () => (await actions.suspend(id), { kind: "ok", text: "Compte suspendu : il ne peut plus se connecter." }));
          if (act === "restore") return attempt(back, async () => (await actions.restore(id), { kind: "ok", text: "Compte réactivé." }));
          if (act === "recovery")
            return attempt(back, async () => ({ kind: "ok", text: "Lien de réinitialisation créé (à transmettre à la personne) :", link: await actions.recoveryLink(id) }));
          if (act === "delete") {
            try {
              await actions.remove(id, form.get("confirmEmail") ?? "");
              return done("/accounts", { kind: "ok", text: "Compte supprimé définitivement." });
            } catch (e) {
              return done(back, { kind: "error", text: e instanceof ActionError ? e.message : `Erreur : ${(e as Error).message}` });
            }
          }
        }
      }

      if (method === "POST" && path === "/direction/invite" && form) {
        return attempt("/", async () => {
          const email = form.get("email") ?? "";
          const fullName = form.get("fullName") ?? "";
          if (form.get("mode") === "password") {
            const { account, password } = await actions.createDirection(email, fullName);
            return {
              kind: "ok",
              text: `Compte créé pour ${account.email}. Mot de passe temporaire (affiché une seule fois, à transmettre en main propre) :`,
              link: password,
            };
          }
          const acc = await actions.inviteDirection(email, fullName);
          return { kind: "ok", text: `Invitation envoyée à ${acc.email}.` };
        });
      }

      if (method === "POST" && path === "/purge") {
        return attempt("/", async () => {
          const n = await actions.purge();
          return { kind: "ok", text: n ? `${n} compte(s) supprimé(s) définitivement.` : "Aucun compte à purger." };
        });
      }

      return send(res, 404, page("Introuvable", V.errorPage("Page introuvable."), session.csrf));
    } catch (e) {
      return send(res, 500, page("Erreur", V.errorPage(`Erreur : ${(e as Error).message}`), session.csrf));
    }
  };
}

function loadConfig() {
  const envFile = fileURLToPath(new URL("./.env.local", import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const demo = process.env.OWNER_DEMO === "1";
  const port = Number(process.env.OWNER_PORT ?? 4000);
  const maxDirection = Number(process.env.MAX_DIRECTION ?? 2);
  if (demo) return { demo, port, maxDirection, store: new MemoryStore() as AdminStore, passcodeHash: hashPasscode("demo") };

  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OWNER_PASSCODE_HASH"].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing in owner-console/.env.local: ${missing.join(", ")} (see owner-console/README.md).`);
    process.exit(1);
  }
  return {
    demo,
    port,
    maxDirection,
    store: new SupabaseStore(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as AdminStore,
    passcodeHash: process.env.OWNER_PASSCODE_HASH!,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = loadConfig();
  const guard = new Guard(cfg.passcodeHash, cfg.port);
  const handle = createApp({ store: cfg.store, guard, maxDirection: cfg.maxDirection, demo: cfg.demo });
  createServer((req, res) => {
    handle(req, res).catch((e) => send(res, 500, `Erreur : ${V.esc((e as Error).message)}`));
  }).listen(cfg.port, "127.0.0.1", () => {
    console.log(`GoodFly owner console: http://127.0.0.1:${cfg.port}  (${cfg.store.label}${cfg.demo ? ", code: demo" : ""})`);
  });
}
