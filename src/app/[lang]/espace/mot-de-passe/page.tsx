import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PasswordForm } from "@/components/staff/PasswordForm";
import { StaffShell } from "@/components/staff/StaffShell";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { requireDirection } from "@/lib/staff/dal";

async function Gate({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  // Reachable with a temporary password (that is the point of this page).
  await requireDirection(lang, { allowPasswordChange: true });
  return <PasswordForm lang={lang} t={dict.staff.password} />;
}

export default async function PasswordPage({ params }: PageProps<"/[lang]/espace/mot-de-passe">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.staff.password;
  return (
    <StaffShell lang={lang} dict={dict}>
      <section className={`${styles.card} ${styles.narrow}`} aria-labelledby="pw-title">
        <h1 id="pw-title" className={styles.h1}>
          {t.title}
        </h1>
        <p className={styles.muted}>{t.intro}</p>
        <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
          <Gate lang={lang} dict={dict} />
        </Suspense>
      </section>
    </StaffShell>
  );
}
