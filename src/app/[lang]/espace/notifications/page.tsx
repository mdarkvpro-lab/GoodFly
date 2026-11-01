import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice } from "@/components/staff/Notice";
import { PushToggle } from "@/components/staff/PushToggle";
import { StaffShell } from "@/components/staff/StaffShell";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { listProfiles, listStaffRequests, requestNow, requireDirection, staffPath, type StaffRequest } from "@/lib/staff/dal";
import { cancelRemoval, decideRemoval } from "../employes/actions";

type Search = Record<string, string | string[] | undefined>;
const VIEWS = ["decide", "mine", "history"] as const;
type View = (typeof VIEWS)[number];

const statusClass: Record<StaffRequest["status"], string> = {
  pending: styles.tagWarn,
  approved: styles.tagOn,
  rejected: styles.tagOff,
  cancelled: styles.tagOff,
};

async function Requests({ lang, dict, searchParams }: { lang: Locale; dict: Dictionary; searchParams: Promise<Search> }) {
  const t = dict.staff.notifications;
  const te = dict.staff.employees;
  const q = await searchParams;
  const raw = Array.isArray(q.vue) ? q.vue[0] : q.vue;
  const [{ user }, all, people] = await Promise.all([requireDirection(lang), listStaffRequests(lang), listProfiles(lang)]);
  const names = new Map(people.map((p) => [p.id, p.full_name || p.email]));
  const name = (id: string | null) => (id && names.get(id)) || "—";

  // À décider: oldest first (waiting longest). Others: newest first.
  const lists: Record<View, StaffRequest[]> = {
    decide: all.filter((r) => r.status === "pending" && r.requested_by !== user.id).reverse(),
    mine: all.filter((r) => r.status === "pending" && r.requested_by === user.id),
    history: all
      .filter((r) => r.status !== "pending")
      .sort((a, b) => (b.decided_at ?? b.created_at).localeCompare(a.decided_at ?? a.created_at)),
  };
  // Open the tab that needs attention first.
  const view: View = (VIEWS as readonly string[]).includes(raw ?? "") ? (raw as View) : lists.decide.length ? "decide" : lists.mine.length ? "mine" : "history";
  const rows = lists[view];

  const locale = lang === "ar" ? "ar-MA" : "fr-MA";
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" });
  const rel = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const now = requestNow();
  const ago = (iso: string) => {
    const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
    if (min < 60) return rel.format(-min, "minute");
    if (min < 48 * 60) return rel.format(-Math.round(min / 60), "hour");
    return rel.format(-Math.round(min / 1440), "day");
  };
  const hidden = (n: string, v: string) => <input type="hidden" name={n} value={v} />;

  return (
    <>
      <nav aria-label={t.tabsLabel} className={styles.filters}>
        {VIEWS.map((v) => (
          <Link key={v} href={`${staffPath(lang, "notifications")}?vue=${v}`} aria-current={view === v}>
            {t.tabs[v]} ({lists[v].length})
          </Link>
        ))}
      </nav>

      {rows.length === 0 && <p className={`${styles.card} ${styles.muted}`}>{t.empty[view]}</p>}

      <ul className={styles.notifList}>
        {rows.map((r) => (
          <li key={r.id} className={`${styles.card} ${styles.notif}`} data-kind={r.kind}>
            <div className={styles.employeeHead}>
              <div>
                <span className={`${styles.tag} ${r.kind === "restore" ? styles.tagNew : styles.tagOff}`}>{r.kind === "restore" ? te.kindRestore : te.kindRemove}</span>{" "}
                <strong dir="auto">{name(r.employee)}</strong>
              </div>
              <span className={styles.muted} title={date.format(new Date(r.created_at))}>
                {t.by.replace("{name}", name(r.requested_by))} · {ago(r.created_at)}
              </span>
            </div>
            {r.reason && (
              <p className={styles.quote} dir="auto">
                {r.reason}
              </p>
            )}

            {view === "decide" && (
              <div className={styles.row}>
                {(["approve", "reject"] as const).map((d) => (
                  <form key={d} action={decideRemoval} className={styles.inlineForm}>
                    {hidden("lang", lang)}
                    {hidden("request", r.id)}
                    {hidden("kind", r.kind)}
                    {hidden("decision", d)}
                    {hidden("back", "notifications")}
                    <button className={d === "approve" ? styles.button : styles.ghost} type="submit">
                      {d === "approve" ? te.approve : te.reject}
                    </button>
                  </form>
                ))}
              </div>
            )}

            {view === "mine" && (
              <div className={styles.row}>
                <span className={styles.muted}>{te.waitingOther}</span>
                <form action={cancelRemoval} className={styles.inlineForm}>
                  {hidden("lang", lang)}
                  {hidden("request", r.id)}
                  {hidden("back", "notifications")}
                  <button className={styles.ghost} type="submit">
                    {te.cancel}
                  </button>
                </form>
              </div>
            )}

            {view === "history" && (
              <p className={styles.row}>
                <span className={`${styles.tag} ${statusClass[r.status]}`}>{t.statuses[r.status]}</span>
                <span className={styles.muted}>
                  {r.decided_by && r.status !== "cancelled" ? `${t.decidedBy.replace("{name}", name(r.decided_by))} · ` : ""}
                  {date.format(new Date(r.decided_at ?? r.created_at))}
                </span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function NotificationsPage({ params, searchParams }: PageProps<"/[lang]/espace/notifications">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <StaffShell lang={lang} dict={dict}>
      <h1 className={styles.h1}>{dict.staff.notifications.title}</h1>
      <p className={styles.muted}>{dict.staff.notifications.intro}</p>
      <Suspense fallback={null}>
        <Notice searchParams={searchParams} dict={dict} />
      </Suspense>
      {process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && <PushToggle lang={lang} vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} t={dict.staff.notifications.push} />}
      <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
        <Requests lang={lang} dict={dict} searchParams={searchParams} />
      </Suspense>
    </StaffShell>
  );
}
