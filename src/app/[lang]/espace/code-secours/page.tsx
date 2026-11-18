import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { RecoveryForm } from "@/components/staff/TwoFactor";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { hasTotp, requireStaff, staffPath } from "@/lib/staff/dal";
import { signOut } from "../actions";

async function Gate({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const { supabase, aal } = await requireStaff(lang, { mfaStep: true });
  if (aal === "aal2") redirect(staffPath(lang, "mon-compte"));
  if (!(await hasTotp(supabase))) redirect(staffPath(lang, "activer-2fa"));
  return <RecoveryForm lang={lang} t={dict.staff.twoFactor} backHref={staffPath(lang, "verification")} />;
}

/** Lost phone: a backup code removes the 2FA, then it is set up again on the new phone. */
export default async function RecoveryPage({ params }: PageProps<"/[lang]/espace/code-secours">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.staff.twoFactor;
  return (
    <StaffShell lang={lang} dict={dict} withNav={false}>
      <section className={`${styles.card} ${styles.narrow}`} aria-labelledby="tf-title">
        <h1 id="tf-title" className={styles.h1}>
          {t.recoveryTitle}
        </h1>
        <p className={styles.muted}>{t.recoveryIntro}</p>
        <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
          <Gate lang={lang} dict={dict} />
        </Suspense>
        <form action={signOut}>
          <input type="hidden" name="lang" value={lang} />
          <button className={styles.ghost} type="submit">
            {dict.staff.nav.logout}
          </button>
        </form>
      </section>
    </StaffShell>
  );
}
