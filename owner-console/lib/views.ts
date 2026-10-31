/** Server-rendered pages for the owner console. All dynamic text goes through esc(). */
import type { Account, AuditEntry, Role } from "./store.ts";

export const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const ROLE_LABEL: Record<Role, string> = { owner: "Propriétaire", direction: "Direction", agent: "Agent", client: "Client" };

const ACTION_LABEL: Record<string, string> = {
  owner_invite_direction: "Invitation Direction (console)",
  owner_create_direction: "Création Direction avec mot de passe temporaire (console)",
  owner_set_role: "Changement de rôle (console)",
  owner_suspend: "Suspension (console)",
  owner_restore: "Réactivation (console)",
  owner_delete: "Suppression définitive (console)",
  owner_recovery_link: "Lien de réinitialisation (console)",
  owner_purge: "Purge après 30 jours (console)",
  deactivate_account: "Désactivation par la Direction",
  restore_account: "Restauration par la Direction",
};

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";

export type Flash = { kind: "ok" | "error"; text: string; link?: string };

type Layout = { title: string; body: string; csrf?: string; flash?: Flash | null; storeLabel: string; nav?: "home" | "accounts" | "audit" };

export function layout({ title, body, csrf, flash, storeLabel, nav }: Layout): string {
  const link = (href: string, label: string, key: Layout["nav"]) =>
    `<a href="${href}"${nav === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} — Console propriétaire GoodFly</title>
<link rel="stylesheet" href="/app.css">
</head>
<body>
<header class="top">
  <div class="brand"><span class="dot" aria-hidden="true"></span> Console propriétaire <span class="badge">${esc(storeLabel)}</span></div>
  ${
    csrf
      ? `<nav aria-label="Console">${link("/", "Vue d'ensemble", "home")}${link("/accounts", "Comptes", "accounts")}${link("/audit", "Journal", "audit")}</nav>
  <form method="post" action="/logout"><input type="hidden" name="csrf" value="${esc(csrf)}"><button class="ghost" type="submit">Se déconnecter</button></form>`
      : ""
  }
</header>
<p class="local">Fonctionne uniquement sur cet ordinateur (127.0.0.1) — jamais en ligne.</p>
<main>
${flash ? `<div class="flash ${flash.kind}" role="status">${esc(flash.text)}${flash.link ? `<br><code class="copy">${esc(flash.link)}</code>` : ""}</div>` : ""}
${body}
</main>
</body>
</html>`;
}

export function loginPage(opts: { error?: string; demo: boolean }): string {
  return `<section class="card narrow">
  <h1>Connexion</h1>
  <p class="muted">Saisissez votre code propriétaire.${opts.demo ? " Mode démo : le code est <strong>demo</strong>." : ""}</p>
  ${opts.error ? `<p class="error-text" role="alert">${esc(opts.error)}</p>` : ""}
  <form method="post" action="/login" class="stack">
    <label>Code propriétaire<input type="password" name="passcode" autocomplete="current-password" required autofocus></label>
    <button type="submit">Entrer</button>
  </form>
</section>`;
}

const statusTag = (a: Account) =>
  a.disabledAt ? `<span class="tag off">Suspendu depuis ${esc(fmt(a.disabledAt))}</span>` : `<span class="tag on">Actif</span>`;

function auditRows(entries: AuditEntry[], accounts: Account[]): string {
  if (!entries.length) return `<p class="muted">Aucune action enregistrée pour l'instant.</p>`;
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return `<table><thead><tr><th scope="col">Quand</th><th scope="col">Action</th><th scope="col">Compte</th><th scope="col">Détails</th></tr></thead><tbody>
${entries
  .map((e) => {
    const target = e.target ? byId.get(e.target) : undefined;
    const who = target ? `${target.fullName} (${target.email})` : String(e.details.email ?? e.target ?? "—");
    const details = Object.entries(e.details)
      .filter(([k]) => !["via", "email"].includes(k))
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join(" · ");
    return `<tr><td>${esc(fmt(e.createdAt))}</td><td>${esc(ACTION_LABEL[e.action] ?? e.action)}</td><td>${esc(who)}</td><td class="muted">${esc(details || "—")}</td></tr>`;
  })
  .join("\n")}
</tbody></table>`;
}

export function overviewPage(accounts: Account[], audit: AuditEntry[], csrf: string, maxDirection: number): string {
  const direction = accounts.filter((a) => a.role === "direction");
  const count = (role: Role) => accounts.filter((a) => a.role === role && !a.disabledAt).length;
  const suspended = accounts.filter((a) => a.disabledAt && a.role !== "owner").length;
  const activeDirection = direction.filter((a) => !a.disabledAt).length;

  const cards = direction
    .map(
      (a) => `<article class="card person">
  <div class="avatar" aria-hidden="true">${esc(a.fullName.trim().charAt(0).toUpperCase() || "?")}</div>
  <div><h3>${esc(a.fullName)}</h3><p class="muted">${esc(a.email)}</p>${statusTag(a)}</div>
  <a class="button ghost" href="/accounts/${esc(a.id)}">Gérer</a>
</article>`,
    )
    .join("\n");

  return `<h1>Vue d'ensemble</h1>
<div class="stats">
  <div class="card stat"><span class="muted">Direction active</span><strong>${activeDirection} / ${maxDirection}</strong></div>
  <div class="card stat"><span class="muted">Agents actifs</span><strong>${count("agent")}</strong></div>
  <div class="card stat"><span class="muted">Clients actifs</span><strong>${count("client")}</strong></div>
  <div class="card stat"><span class="muted">Comptes suspendus</span><strong>${suspended}</strong></div>
</div>

<h2>Comptes Direction</h2>
<div class="people">${cards || `<p class="muted">Aucun compte Direction.</p>`}</div>

<section class="card">
  <h2>Ajouter un compte Direction</h2>
  <p class="muted">Maximum ${maxDirection} comptes Direction actifs. « Mot de passe temporaire » ne dépend pas des e-mails
  (le plan gratuit de Supabase n'envoie des e-mails qu'à l'équipe du projet) : le mot de passe s'affiche une seule fois, à transmettre en main propre.</p>
  <form method="post" action="/direction/invite" class="row">
    <input type="hidden" name="csrf" value="${esc(csrf)}">
    <label>Nom<input name="fullName" required maxlength="120"></label>
    <label>E-mail<input name="email" type="email" required></label>
    <button type="submit" name="mode" value="password"${activeDirection >= maxDirection ? " disabled" : ""}>Créer avec mot de passe temporaire</button>
    <button class="ghost" type="submit" name="mode" value="invite"${activeDirection >= maxDirection ? " disabled" : ""}>Inviter par e-mail</button>
  </form>
</section>

<section class="card">
  <h2>Purge</h2>
  <p class="muted">Supprime définitivement les comptes suspendus depuis plus de 30 jours (jamais le compte propriétaire).</p>
  <form method="post" action="/purge"><input type="hidden" name="csrf" value="${esc(csrf)}"><button class="danger" type="submit">Purger maintenant</button></form>
</section>

<section class="card">
  <h2>Dernières actions</h2>
  ${auditRows(audit.slice(0, 8), accounts)}
  <p><a href="/audit">Voir tout le journal →</a></p>
</section>`;
}

export function accountsPage(accounts: Account[], filter: { role?: string; q?: string }): string {
  const q = (filter.q ?? "").toLowerCase();
  const rows = accounts
    .filter((a) => !filter.role || a.role === filter.role)
    .filter((a) => !q || a.email.toLowerCase().includes(q) || a.fullName.toLowerCase().includes(q))
    .map(
      (a) => `<tr>
  <td><strong>${esc(a.fullName)}</strong><br><span class="muted">${esc(a.email)}</span></td>
  <td>${esc(ROLE_LABEL[a.role])}</td>
  <td>${statusTag(a)}</td>
  <td class="muted">${esc(fmt(a.lastSignInAt))}</td>
  <td>${a.role === "owner" ? `<span class="muted">Protégé</span>` : `<a href="/accounts/${esc(a.id)}">Gérer</a>`}</td>
</tr>`,
    )
    .join("\n");
  const opt = (v: string, label: string) => `<option value="${v}"${filter.role === v ? " selected" : ""}>${label}</option>`;
  return `<h1>Comptes</h1>
<form method="get" action="/accounts" class="row card">
  <label>Rôle<select name="role">${opt("", "Tous")}${opt("direction", "Direction")}${opt("agent", "Agents")}${opt("client", "Clients")}${opt("owner", "Propriétaire")}</select></label>
  <label>Recherche<input name="q" value="${esc(filter.q ?? "")}" placeholder="Nom ou e-mail"></label>
  <button type="submit">Filtrer</button>
</form>
<div class="card scroll"><table>
<thead><tr><th scope="col">Compte</th><th scope="col">Rôle</th><th scope="col">Statut</th><th scope="col">Dernière connexion</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
<tbody>${
    rows ||
    `<tr><td colspan="5" class="muted">${
      accounts.length
        ? "Aucun compte ne correspond à ce filtre."
        : `Aucun compte pour l'instant. Commencez par <a href="/">ajouter un compte Direction</a> depuis la vue d'ensemble.`
    }</td></tr>`
  }</tbody>
</table></div>`;
}

export function accountPage(a: Account, csrf: string): string {
  const hidden = `<input type="hidden" name="csrf" value="${esc(csrf)}">`;
  const roleOptions = (["direction", "agent", "client"] as Role[])
    .map((r) => `<option value="${r}"${a.role === r ? " selected" : ""}>${ROLE_LABEL[r]}</option>`)
    .join("");
  return `<p><a href="/accounts">← Tous les comptes</a></p>
<h1>${esc(a.fullName)}</h1>
<p class="muted">${esc(a.email)} · ${esc(ROLE_LABEL[a.role])} · créé le ${esc(fmt(a.createdAt))} · dernière connexion ${esc(fmt(a.lastSignInAt))}</p>
<p>${statusTag(a)}</p>

<div class="grid2">
<section class="card">
  <h2>Rôle</h2>
  <form method="post" action="/accounts/${esc(a.id)}/role" class="row">${hidden}
    <label>Nouveau rôle<select name="role">${roleOptions}</select></label>
    <button type="submit">Enregistrer</button>
  </form>
</section>

<section class="card">
  <h2>Accès</h2>
  ${
    a.disabledAt
      ? `<form method="post" action="/accounts/${esc(a.id)}/restore">${hidden}<button type="submit">Réactiver le compte</button></form>`
      : `<p class="muted">Le compte ne pourra plus se connecter au site.</p><form method="post" action="/accounts/${esc(a.id)}/suspend">${hidden}<button class="danger" type="submit">Suspendre</button></form>`
  }
  <form method="post" action="/accounts/${esc(a.id)}/recovery" class="spaced">${hidden}<button class="ghost" type="submit">Créer un lien de réinitialisation du mot de passe</button></form>
</section>
</div>

<section class="card danger-zone">
  <h2>Suppression définitive</h2>
  <p class="muted">Irréversible. Pour confirmer, saisissez l'e-mail du compte : <strong>${esc(a.email)}</strong></p>
  <form method="post" action="/accounts/${esc(a.id)}/delete" class="row">${hidden}
    <label>E-mail de confirmation<input name="confirmEmail" autocomplete="off" required></label>
    <button class="danger" type="submit">Supprimer définitivement</button>
  </form>
</section>`;
}

export function auditPage(entries: AuditEntry[], accounts: Account[]): string {
  return `<h1>Journal des actions</h1><div class="card scroll">${auditRows(entries, accounts)}</div>`;
}

export function errorPage(text: string): string {
  return `<section class="card narrow"><h1>Erreur</h1><p>${esc(text)}</p><p><a href="/">Retour</a></p></section>`;
}
