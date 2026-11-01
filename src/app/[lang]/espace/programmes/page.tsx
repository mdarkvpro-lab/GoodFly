import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice } from "@/components/staff/Notice";
import { StaffShell } from "@/components/staff/StaffShell";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { programImageUrl } from "@/lib/programs/data";
import { listStaffPrograms, requireStaff, staffPath } from "@/lib/staff/dal";
import { deleteProgram } from "./actions";

async function Programs({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.staff.programs;
  const [{ user }, programs] = await Promise.all([requireStaff(lang, { permission: "programs.manage" }), listStaffPrograms(lang)]);
  const date = new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium" });
  if (!programs.length) return <p className={`${styles.card} ${styles.muted}`}>{t.empty}</p>;
  return (
    <div className={`${styles.card} ${styles.tableWrap}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t.photo}</th>
            <th scope="col">{t.fields.title_fr}</th>
            <th scope="col">{t.fields.status}</th>
            <th scope="col">{t.updated}</th>
            <th scope="col">{dict.staff.accounts.actions}</th>
          </tr>
        </thead>
        <tbody>
          {programs.map((p) => {
            const img = programImageUrl(p.image_path);
            return (
              <tr key={p.id}>
                <td>
                  {/* eslint-disable-next-line @next/next/no-img-element -- small list thumbnail */}
                  {img ? <img className={styles.thumb} src={img} alt="" width={96} height={64} loading="lazy" /> : <span className={styles.thumb} />}
                </td>
                <td>
                  <strong>{(lang === "ar" && p.title_ar) || p.title_fr}</strong>
                  <br />
                  <span className={styles.muted} dir="ltr">
                    /{p.slug}
                  </span>
                </td>
                <td>
                  <span className={`${styles.tag} ${p.status === "published" ? styles.tagOn : styles.tagOff}`}>{t.statuses[p.status]}</span>
                </td>
                <td className={styles.muted}>{date.format(new Date(p.updated_at))}</td>
                <td>
                  <div className={styles.actionsCell}>
                    <Link className={styles.ghost} href={staffPath(lang, `programmes/${p.id}`)}>
                      {t.edit}
                    </Link>
                    {p.status === "published" && (
                      <Link className={styles.ghost} href={`/${lang}/programmes/${p.slug}`} target="_blank">
                        {t.view}
                      </Link>
                    )}
                    {user.role === "direction" && (
                      <form action={deleteProgram} className={styles.inlineForm}>
                        <input type="hidden" name="lang" value={lang} />
                        <input type="hidden" name="id" value={p.id} />
                        <button className={styles.danger} type="submit">
                          {t.delete}
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function ProgramsPage({ params, searchParams }: PageProps<"/[lang]/espace/programmes">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.staff.programs;
  return (
    <StaffShell lang={lang} dict={dict}>
      <div className={styles.headRow}>
        <h1 className={styles.h1}>{t.title}</h1>
        <Link className={styles.button} href={staffPath(lang, "programmes/nouveau")}>
          {t.new}
        </Link>
      </div>
      <p className={styles.muted}>{t.intro}</p>
      <Suspense fallback={null}>
        <Notice searchParams={searchParams} dict={dict} />
      </Suspense>
      <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
        <Programs lang={lang} dict={dict} />
      </Suspense>
    </StaffShell>
  );
}
