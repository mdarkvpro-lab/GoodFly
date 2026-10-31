import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { listAudit, listProfiles } from "@/lib/staff/dal";

async function Journal({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.staff.journal;
  const [entries, rows] = await Promise.all([listAudit(lang), listProfiles(lang)]);
  const names = new Map(rows.map((r) => [r.id, r.full_name || r.email]));
  const when = new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeStyle: "short" });
  const actions = t.actions as Record<string, string>;
  if (!entries.length) return <p className={`${styles.card} ${styles.muted}`}>{t.empty}</p>;
  return (
    <div className={`${styles.card} ${styles.tableWrap}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t.when}</th>
            <th scope="col">{t.action}</th>
            <th scope="col">{t.account}</th>
            <th scope="col">{t.by}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td className={styles.muted}>{when.format(new Date(e.created_at))}</td>
              <td>{actions[e.action] ?? e.action}</td>
              <td>{(e.target && names.get(e.target)) || String(e.details.email ?? "—")}</td>
              <td>{e.actor ? (names.get(e.actor) ?? "—") : t.system}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function JournalPage({ params }: PageProps<"/[lang]/espace/journal">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <StaffShell lang={lang} dict={dict}>
      <h1 className={styles.h1}>{dict.staff.journal.title}</h1>
      <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
        <Journal lang={lang} dict={dict} />
      </Suspense>
    </StaffShell>
  );
}
