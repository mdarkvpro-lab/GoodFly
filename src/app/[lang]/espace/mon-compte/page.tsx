import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice } from "@/components/staff/Notice";
import { StaffShell } from "@/components/staff/StaffShell";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { requireStaff, staffPath } from "@/lib/staff/dal";
import { updateOwnName } from "../actions";

async function Me({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.staff.me;
  const { user } = await requireStaff(lang);
  return (
    <section className={styles.card}>
      <form action={updateOwnName} className={styles.row}>
        <input type="hidden" name="lang" value={lang} />
        <label className={styles.label}>
          {t.name}
          <input className={styles.input} name="fullName" defaultValue={user.fullName} maxLength={120} required />
        </label>
        <button className={styles.button} type="submit">
          {t.save}
        </button>
      </form>
      <p>
        <span className={styles.muted}>{t.email} : </span>
        <span dir="ltr">{user.email}</span>
      </p>
      <p>
        <span className={styles.muted}>{t.access} : </span>
        {user.role === "direction"
          ? t.allAccess
          : user.permissions.map((p) => (dict.staff.permissions as Record<string, string>)[p]).join(" · ") || "—"}
      </p>
      <p>
        <Link href={staffPath(lang, "mot-de-passe")}>{t.changePassword}</Link>
      </p>
    </section>
  );
}

export default async function MePage({ params, searchParams }: PageProps<"/[lang]/espace/mon-compte">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <StaffShell lang={lang} dict={dict}>
      <h1 className={styles.h1}>{dict.staff.me.title}</h1>
      <Suspense fallback={null}>
        <Notice searchParams={searchParams} dict={dict} />
      </Suspense>
      <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
        <Me lang={lang} dict={dict} />
      </Suspense>
    </StaffShell>
  );
}
