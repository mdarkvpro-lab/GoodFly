import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { EnrollFlow } from "@/components/staff/TwoFactor";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { hasTotp, requireStaff, staffPath } from "@/lib/staff/dal";
import { signOut } from "../actions";

async function Gate({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const { supabase, aal } = await requireStaff(lang, { mfaStep: true });
  // Already set up but not verified in this session: ask for the code, never a second setup.
  // (Right after the setup the page stays here, so the backup codes can be shown.)
  if (aal !== "aal2" && (await hasTotp(supabase))) redirect(staffPath(lang, "verification"));
  return <EnrollFlow lang={lang} t={dict.staff.twoFactor} next={staffPath(lang)} />;
}

/** First sign-in (or after a reset): set up the authenticator app. */
export default async function EnrollPage({ params }: PageProps<"/[lang]/espace/activer-2fa">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.staff.twoFactor;
  return (
    <StaffShell lang={lang} dict={dict} withNav={false}>
      <section className={`${styles.card} ${styles.narrow}`} aria-labelledby="tf-title">
        <h1 id="tf-title" className={styles.h1}>
          {t.setupTitle}
        </h1>
        <p className={styles.muted}>{t.setupIntro}</p>
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
