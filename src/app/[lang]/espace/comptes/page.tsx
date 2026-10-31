import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice } from "@/components/staff/Notice";
import { StaffShell } from "@/components/staff/StaffShell";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { listProfiles, requireDirection, staffPath } from "@/lib/staff/dal";
import { accountAction } from "../actions";

type Search = Record<string, string | string[] | undefined>;
const FILTERS = ["all", "client", "agent", "direction"] as const;

async function Accounts({ lang, dict, searchParams }: { lang: Locale; dict: Dictionary; searchParams: Promise<Search> }) {
  const t = dict.staff.accounts;
  const [{ user }, rows, q] = await Promise.all([requireDirection(lang), listProfiles(lang), searchParams]);
  const raw = Array.isArray(q.role) ? q.role[0] : q.role;
  const filter = (FILTERS as readonly string[]).includes(raw ?? "") ? raw! : "all";
  const shown = rows.filter((r) => r.role !== "owner" && (filter === "all" || r.role === filter));
  const date = new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium" });

  const act = (id: string, op: string, label: string, extra?: { role: string }, danger = false) => (
    <form action={accountAction} className={styles.inlineForm}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      {extra && <input type="hidden" name="role" value={extra.role} />}
      <button className={danger ? styles.danger : styles.ghost} type="submit">
        {label}
      </button>
    </form>
  );

  return (
    <>
      <nav aria-label={t.filters.label} className={styles.filters}>
        {FILTERS.map((f) => (
          <Link key={f} href={`${staffPath(lang, "comptes")}${f === "all" ? "" : `?role=${f}`}`} aria-current={filter === f}>
            {t.filters[f]}
          </Link>
        ))}
      </nav>
      <div className={`${styles.card} ${styles.tableWrap}`}>
        {shown.length === 0 ? (
          <p className={styles.muted}>{t.empty}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t.name}</th>
                <th scope="col">{t.role}</th>
                <th scope="col">{t.status}</th>
                <th scope="col">{t.since}</th>
                <th scope="col">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.full_name || t.noName}</strong>
                    {r.id === user.id && <span className={styles.muted}> · {t.you}</span>}
                    <br />
                    <span className={styles.muted} dir="ltr">
                      {r.email}
                    </span>
                  </td>
                  <td>{t.roles[r.role]}</td>
                  <td>
                    <span className={`${styles.tag} ${r.disabled_at ? styles.tagOff : styles.tagOn}`}>{r.disabled_at ? t.suspended : t.active}</span>
                  </td>
                  <td className={styles.muted}>{date.format(new Date(r.created_at))}</td>
                  <td>
                    {r.role === "direction" ? (
                      <span className={styles.muted}>{t.protected}</span>
                    ) : (
                      <div className={styles.actionsCell}>
                        {r.disabled_at ? act(r.id, "restore", t.restore) : act(r.id, "deactivate", t.deactivate, undefined, true)}
                        {!r.disabled_at &&
                          (r.role === "client" ? act(r.id, "role", t.makeAgent, { role: "agent" }) : act(r.id, "role", t.makeClient, { role: "client" }))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default async function AccountsPage({ params, searchParams }: PageProps<"/[lang]/espace/comptes">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <StaffShell lang={lang} dict={dict}>
      <h1 className={styles.h1}>{dict.staff.accounts.title}</h1>
      <p className={styles.muted}>{dict.staff.accounts.intro}</p>
      <Suspense fallback={null}>
        <Notice searchParams={searchParams} dict={dict} />
      </Suspense>
      <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
        <Accounts lang={lang} dict={dict} searchParams={searchParams} />
      </Suspense>
    </StaffShell>
  );
}
