import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClientsChart } from "@/components/staff/ClientsChart";
import { Notice } from "@/components/staff/Notice";
import { StaffShell } from "@/components/staff/StaffShell";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { listProfiles } from "@/lib/staff/dal";
import { clientsByMonth, kpis } from "@/lib/staff/stats";

async function Overview({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.staff.overview;
  const rows = await listProfiles(lang);
  const now = new Date();
  const k = kpis(rows, now);
  const nf = new Intl.NumberFormat(lang === "ar" ? "ar-MA" : "fr-MA");
  const last = (n: number) => t.lastMonth.replace("{n}", nf.format(n));
  return (
    <>
      <div className={styles.kpis}>
        <div className={`${styles.card} ${styles.kpi}`}>
          <span className={styles.muted}>{t.activeClients}</span>
          <strong>{nf.format(k.activeClients)}</strong>
        </div>
        <div className={`${styles.card} ${styles.kpi}`}>
          <span className={styles.muted}>{t.newClients}</span>
          <strong>{nf.format(k.newThisMonth)}</strong>
          <span className={styles.muted}>{last(k.newLastMonth)}</span>
        </div>
        <div className={`${styles.card} ${styles.kpi}`}>
          <span className={styles.muted}>{t.lostClients}</span>
          <strong>{nf.format(k.lostThisMonth)}</strong>
          <span className={styles.muted}>{last(k.lostLastMonth)}</span>
        </div>
        <div className={`${styles.card} ${styles.kpi}`}>
          <span className={styles.muted}>{t.activeAgents}</span>
          <strong>{nf.format(k.activeAgents)}</strong>
        </div>
      </div>
      <ClientsChart lang={lang} points={clientsByMonth(rows, now)} t={t} />
      <p className={styles.muted}>{t.bookingsSoon}</p>
    </>
  );
}

export default async function StaffHome({ params, searchParams }: PageProps<"/[lang]/espace">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <StaffShell lang={lang} dict={dict}>
      <h1 className={styles.h1}>{dict.staff.overview.title}</h1>
      <Suspense fallback={null}>
        <Notice searchParams={searchParams} dict={dict} />
      </Suspense>
      <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
        <Overview lang={lang} dict={dict} />
      </Suspense>
    </StaffShell>
  );
}
