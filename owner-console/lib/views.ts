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

/** Small line icons (inline SVG, no external files). */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><path d="M15.5 5.2a3 3 0 0 1 0 5.6"/><path d="M17.5 14.3c1.8.6 3 2.1 3.5 4.7"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="2.5"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M3 13h18"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',
  pause: '<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17.5" r="1"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  broom: '<path d="M14 4 9.5 12.5"/><path d="M6 13h8l1.5 7H4.5z"/><path d="M8 16.5v3.5M11 16.5v3.5"/>',
  logout: '<path d="M14 4h4.5a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  plane: '<path d="M21 4 3 11l6.5 2.5L12 20l3-6.5z"/><path d="m9.5 13.5 5-5"/>',
} as const;

const icon = (name: keyof typeof ICONS, cls = "icon") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

/** The logo's sun-over-sea emblem (same shapes as the website), animated by app.css only. */
function emblem(): string {
  const bands = [[64, 44], [116, 36], [160, 31], [199, 26], [233, 22], [263, 18], [289, 14]]
    .map(([y, h]) => `<rect x="68" y="${y}" width="464" height="${h}" fill="#f8e21a"/>`)
    .join("");
  const wave = (y: number, amp: number, phase: number) => {
    let d = `M 58 640 L 58 ${y}`;
    for (let x = 0; x <= 968; x += 8) d += ` L ${58 + x} ${(y + amp * Math.sin(((x + phase) / 242) * Math.PI * 2)).toFixed(1)}`;
    return `${d} L 1026 640 Z`;
  };
  return `<svg class="emblem" viewBox="0 0 600 600" aria-hidden="true" focusable="false">
  <defs><clipPath id="disc"><circle cx="300" cy="300" r="232"/></clipPath>
    <radialGradient id="glow"><stop offset="0.7" stop-color="#f8e21a" stop-opacity="0.22"/><stop offset="1" stop-color="#f8e21a" stop-opacity="0"/></radialGradient></defs>
  <circle cx="300" cy="300" r="295" fill="url(#glow)"/>
  <g clip-path="url(#disc)">${bands}
    <path class="wave w1" d="${wave(316, 9, 0)}" fill="#7fd3ff"/>
    <path class="wave w2" d="${wave(352, 11, 60)}" fill="#2ea0ff"/>
    <path class="wave w3" d="${wave(394, 12, 130)}" fill="#0858f8"/>
    <path class="wave w2" d="${wave(438, 10, 30)}" fill="#0a46c8"/>
  </g>
  <path class="route" d="M 18 478 C 150 270, 330 118, 588 150"/>
  <path class="emblem-plane" transform="translate(468 128) rotate(-12) scale(2)" d="M18 0 L5 -2 L-5 -15 L-9.5 -15 L-4 -2 L-12 -2 L-16 -7.5 L-19 -7.5 L-16.5 0 L-19 7.5 L-16 7.5 L-12 2 L-4 2 L-9.5 15 L-5 15 L5 2 Z"/>
</svg>`;
}

export type Flash = { kind: "ok" | "error"; text: string; link?: string };

type Layout = { title: string; body: string; csrf?: string; flash?: Flash | null; storeLabel: string; nav?: "home" | "accounts" | "audit" };

export function layout({ title, body, csrf, flash, storeLabel, nav }: Layout): string {
  const link = (href: string, label: string, key: Layout["nav"], ic: keyof typeof ICONS) =>
    `<a href="${href}"${nav === key ? ' aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} — Console propriétaire GoodFly</title>
<link rel="stylesheet" href="/app.css">
</head>
<body${csrf ? "" : ' class="signed-out"'}>
<header class="top">
  <a class="brand" href="/"><span class="logo-chip"><img src="/logo.webp" alt="GoodFly" width="88" height="44"></span><span class="brand-text"><strong>Console propriétaire</strong><span class="badge">${esc(storeLabel)}</span></span></a>
  ${
    csrf
      ? `<nav aria-label="Console">${link("/", "Vue d'ensemble", "home", "home")}${link("/accounts", "Comptes", "accounts", "users")}${link("/audit", "Journal", "audit", "list")}</nav>
  <form method="post" action="/logout" class="logout"><input type="hidden" name="csrf" value="${esc(csrf)}"><button class="ghost" type="submit">${icon("logout")}<span>Se déconnecter</span></button></form>`
      : ""
  }
</header>
<p class="local">${icon("lock", "icon small")}<span>Fonctionne uniquement sur cet ordinateur (127.0.0.1) — jamais en ligne.</span></p>
<main>
${flash ? `<div class="flash ${flash.kind}" role="status">${esc(flash.text)}${flash.link ? `<br><code class="copy">${esc(flash.link)}</code>` : ""}</div>` : ""}
${body}
</main>
<footer class="foot">${icon("plane", "icon small")}<span>GoodFly 2.0 · console du propriétaire</span></footer>
</body>
</html>`;
}

export function loginPage(opts: { error?: string; demo: boolean }): string {
  return `<section class="login">
  <div class="login-art">${emblem()}<p class="login-tag">Toutes les clés de GoodFly, sur votre ordinateur.</p></div>
  <div class="card login-card">
    <span class="eyebrow">${icon("shield", "icon small")} Accès propriétaire</span>
    <h1>Connexion</h1>
    <p class="muted">Saisissez votre code propriétaire.${opts.demo ? " Mode démo : le code est <strong>demo</strong>." : ""}</p>
    ${opts.error ? `<p class="error-text" role="alert">${esc(opts.error)}</p>` : ""}
    <form method="post" action="/login" class="stack">
      <label>Code propriétaire<input type="password" name="passcode" autocomplete="current-password" required autofocus></label>
      <button type="submit">Entrer</button>
    </form>
  </div>
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

  const today = new Intl.DateTimeFormat("fr-MA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const stat = (ic: keyof typeof ICONS, tone: string, label: string, value: string) =>
    `<div class="card stat ${tone}"><span class="stat-icon">${icon(ic)}</span><span class="muted">${label}</span><strong>${value}</strong></div>`;
  return `<header class="page-head hero-head">
  <div><span class="eyebrow">${esc(today)}</span><h1>Vue d'ensemble</h1><p class="muted">L'état des comptes de l'agence, en un coup d'œil.</p></div>
  ${emblem()}
</header>
<div class="stats">
  ${stat("users", "tone-sun", "Direction active", `${activeDirection} / ${maxDirection}`)}
  ${stat("briefcase", "tone-sky", "Agents actifs", String(count("agent")))}
  ${stat("user", "tone-blue", "Clients actifs", String(count("client")))}
  ${stat("pause", "tone-rose", "Comptes suspendus", String(suspended))}
</div>

<h2 class="section-title">${icon("users")} Comptes Direction</h2>
<div class="people">${cards || `<p class="muted">Aucun compte Direction.</p>`}</div>

<section class="card">
  <h2 class="section-title">${icon("plus")} Ajouter un compte Direction</h2>
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
  <h2 class="section-title">${icon("broom")} Purge</h2>
  <p class="muted">Supprime définitivement les comptes suspendus depuis plus de 30 jours (jamais le compte propriétaire).</p>
  <form method="post" action="/purge"><input type="hidden" name="csrf" value="${esc(csrf)}"><button class="danger" type="submit">Purger maintenant</button></form>
</section>

<section class="card">
  <h2 class="section-title">${icon("list")} Dernières actions</h2>
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
  return `<header class="page-head"><div><span class="eyebrow">${accounts.length} compte(s)</span><h1>Comptes</h1></div></header>
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
<header class="page-head person-head">
  <div class="avatar big" aria-hidden="true">${esc(a.fullName.trim().charAt(0).toUpperCase() || "?")}</div>
  <div><span class="eyebrow">${esc(ROLE_LABEL[a.role])}</span><h1>${esc(a.fullName)}</h1></div>
</header>
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
  return `<header class="page-head"><div><span class="eyebrow">Tout ce qui a été fait, et par qui</span><h1>Journal des actions</h1></div></header><div class="card scroll">${auditRows(entries, accounts)}</div>`;
}

export function errorPage(text: string): string {
  return `<section class="card narrow"><h1>Erreur</h1><p>${esc(text)}</p><p><a href="/">Retour</a></p></section>`;
}
