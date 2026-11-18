import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { ChallengeForm } from "@/components/staff/TwoFactor";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { hasTotp, requireStaff, staffHome, staffPath } from "@/lib/staff/dal";
import { signOut } from "../actions";

async function Gate({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const { supabase, aal, user } = await requireStaff(lang, { mfaStep: true });
  if (aal === "aal2") redirect(staffPath(lang, staffHome(user)));
  if (!(await hasTotp(supabase))) redirect(staffPath(lang, "activer-2fa"));
  return <ChallengeForm lang={lang} t={dict.staff.twoFactor} recoveryHref={staffPath(lang, "code-secours")} />;
}

/** Each sign-in, after the password: the 6-digit code of the app. */
export default async function ChallengePage({ params }: PageProps<"/[lang]/espace/verification">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.staff.twoFactor;
  return (
    <StaffShell lang={lang} dict={dict} withNav={false}>
      <section className={`${styles.card} ${styles.narrow}`} aria-labelledby="tf-title">
        <h1 id="tf-title" className={styles.h1}>
          {t.challengeTitle}
        </h1>
        <p className={styles.muted}>{t.challengeIntro}</p>
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
