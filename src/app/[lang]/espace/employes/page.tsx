import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmployeeForm } from "@/components/staff/EmployeeForm";
import { Notice } from "@/components/staff/Notice";
import { StaffShell } from "@/components/staff/StaffShell";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { PERMISSIONS } from "@/lib/staff/access";
import { listPendingRemovals, listProfiles, requireDirection } from "@/lib/staff/dal";
import { accountAction } from "../actions";
import { cancelRemoval, decideRemoval, requestRemoval, savePermissions } from "./actions";

async function Employees({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.staff.employees;
  const labels = dict.staff.permissions as Record<string, string>;
  const [{ user }, rows, pending] = await Promise.all([requireDirection(lang), listProfiles(lang), listPendingRemovals(lang)]);
  const names = new Map(rows.map((r) => [r.id, r.full_name || r.email]));
  const pendingFor = new Map(pending.map((p) => [p.employee, p]));
  const active = rows.filter((r) => r.role === "agent" && !r.disabled_at);
  const removed = rows.filter((r) => r.role === "agent" && r.disabled_at);
  const date = new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium" });
  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />;

  return (
    <>
      {pending.length > 0 && (
        <section className={styles.section} aria-labelledby="pending-title">
          <h2 id="pending-title" className={styles.h2}>
            {t.pendingTitle}
          </h2>
          {pending.map((p) => {
            const mine = p.requested_by === user.id;
            return (
              <article key={p.id} className={`${styles.card} ${styles.employee}`}>
                <div className={styles.employeeHead}>
                  <strong>{names.get(p.employee) ?? "—"}</strong>
                  <span className={styles.muted}>
                    {t.requestedBy.replace("{name}", (p.requested_by && names.get(p.requested_by)) || "—")} · {date.format(new Date(p.created_at))}
                  </span>
                </div>
                {p.reason && (
                  <p>
                    <span className={styles.muted}>{t.reason} : </span>
                    {p.reason}
                  </p>
                )}
                {mine ? (
                  <div className={styles.row}>
                    <span className={styles.muted}>{t.waitingOther}</span>
                    <form action={cancelRemoval} className={styles.inlineForm}>
                      {hidden("lang", lang)}
                      {hidden("request", p.id)}
                      <button className={styles.ghost} type="submit">
                        {t.cancel}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className={styles.row}>
                    <form action={decideRemoval} className={styles.inlineForm}>
                      {hidden("lang", lang)}
                      {hidden("request", p.id)}
                      {hidden("decision", "approve")}
                      <button className={styles.danger} type="submit">
                        {t.approve}
                      </button>
                    </form>
                    <form action={decideRemoval} className={styles.inlineForm}>
                      {hidden("lang", lang)}
                      {hidden("request", p.id)}
                      {hidden("decision", "reject")}
                      <button className={styles.ghost} type="submit">
                        {t.reject}
                      </button>
                    </form>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      <section className={`${styles.card} ${styles.section}`} aria-labelledby="add-title">
        <h2 id="add-title" className={styles.h2}>
          {t.addTitle}
        </h2>
        <EmployeeForm lang={lang} t={t} labels={labels} />
      </section>

      <section className={styles.section} aria-labelledby="team-title">
        <h2 id="team-title" className={styles.h2}>
          {t.teamTitle}
        </h2>
        {active.length === 0 && <p className={`${styles.card} ${styles.muted}`}>{t.empty}</p>}
        {active.map((r) => {
          const perms = new Set(r.permissions ?? []);
          const req = pendingFor.get(r.id);
          return (
            <article key={r.id} className={`${styles.card} ${styles.employee}`}>
              <div className={styles.employeeHead}>
                <div>
                  <strong>{r.full_name || dict.staff.accounts.noName}</strong>
                  <br />
                  <span className={styles.muted} dir="ltr">
                    {r.email}
                  </span>
                </div>
                <span className={styles.muted}>
                  {t.since} {date.format(new Date(r.created_at))}
                </span>
              </div>
              <form action={savePermissions} className={styles.form}>
                {hidden("lang", lang)}
                {hidden("id", r.id)}
                <fieldset className={styles.checks}>
                  <legend>{t.permissionsLegend}</legend>
                  {PERMISSIONS.map((p) => (
                    <label key={p} className={styles.check}>
                      <input type="checkbox" name="permissions" value={p} defaultChecked={perms.has(p)} />
                      {labels[p]}
                    </label>
                  ))}
                </fieldset>
                <div>
                  <button className={styles.ghost} type="submit">
                    {t.savePermissions}
                  </button>
                </div>
              </form>
              {req ? (
                <p className={`${styles.notice} ${styles.warn}`}>{t.removalPending}</p>
              ) : (
                <details className={styles.more}>
                  <summary>{t.requestRemoval}</summary>
                  <form action={requestRemoval} className={styles.form}>
                    {hidden("lang", lang)}
                    {hidden("id", r.id)}
                    <p className={styles.muted}>{t.removalHint}</p>
                    <label className={styles.label}>
                      {t.reason}
                      <textarea className={styles.textarea} name="reason" maxLength={500} />
                    </label>
                    <div>
                      <button className={styles.danger} type="submit">
                        {t.sendRequest}
                      </button>
                    </div>
                  </form>
                </details>
              )}
            </article>
          );
        })}
      </section>

      {removed.length > 0 && (
        <section className={styles.section} aria-labelledby="removed-title">
          <h2 id="removed-title" className={styles.h2}>
            {t.removedTitle}
          </h2>
          <div className={`${styles.card} ${styles.tableWrap}`}>
            <table className={styles.table}>
              <tbody>
                {removed.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.full_name || dict.staff.accounts.noName}</strong>
                      <br />
                      <span className={styles.muted} dir="ltr">
                        {r.email}
                      </span>
                    </td>
                    <td className={styles.muted}>{date.format(new Date(r.disabled_at!))}</td>
                    <td>
                      <form action={accountAction} className={styles.inlineForm}>
                        {hidden("lang", lang)}
                        {hidden("id", r.id)}
                        {hidden("op", "restore")}
                        {hidden("back", "employes")}
                        <button className={styles.ghost} type="submit">
                          {dict.staff.accounts.restore}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

export default async function EmployeesPage({ params, searchParams }: PageProps<"/[lang]/espace/employes">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <StaffShell lang={lang} dict={dict}>
      <h1 className={styles.h1}>{dict.staff.employees.title}</h1>
      <p className={styles.muted}>{dict.staff.employees.intro}</p>
      <Suspense fallback={null}>
        <Notice searchParams={searchParams} dict={dict} />
      </Suspense>
      <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
        <Employees lang={lang} dict={dict} />
      </Suspense>
    </StaffShell>
  );
}
