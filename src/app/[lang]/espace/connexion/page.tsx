import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/staff/LoginForm";
import { StaffShell } from "@/components/staff/StaffShell";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";

type Search = Record<string, string | string[] | undefined>;

async function Form({ lang, dict, searchParams }: { lang: Locale; dict: Dictionary; searchParams: Promise<Search> }) {
  const q = await searchParams;
  const e = Array.isArray(q.e) ? q.e[0] : q.e;
  const known = e && e in dict.staff.login.errors ? e : undefined;
  return <LoginForm lang={lang} t={dict.staff.login} initialError={known} />;
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/espace/connexion">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.staff.login;
  return (
    <StaffShell lang={lang} dict={dict} withNav={false}>
      <section className={`${styles.card} ${styles.narrow}`} aria-labelledby="login-title">
        <h1 id="login-title" className={styles.h1}>
          {t.title}
        </h1>
        <p className={styles.muted}>{t.intro}</p>
        <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
          <Form lang={lang} dict={dict} searchParams={searchParams} />
        </Suspense>
      </section>
    </StaffShell>
  );
}
