import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingsChart } from "@/components/staff/BookingsChart";
import { Notice } from "@/components/staff/Notice";
import { StaffShell } from "@/components/staff/StaffShell";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { countNewBookings, listBookingStats, listPendingRemovals, listStatsRows, requireStaff, staffPath } from "@/lib/staff/dal";
import { activeAgents, bookingKpis, bookingsByMonth } from "@/lib/staff/stats";

async function Overview({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.staff.overview;
  const [rows, bookingRows] = await Promise.all([listStatsRows(lang), listBookingStats(lang)]);
  const now = new Date();
  const b = bookingKpis(bookingRows, now);
  const tb = t.bookings;
  const nf = new Intl.NumberFormat(lang === "ar" ? "ar-MA" : "fr-MA");
  const last = (n: number) => t.lastMonth.replace("{n}", nf.format(n));
  return (
    <>
      <div className={styles.kpis}>
        <div className={`${styles.card} ${styles.kpi}`}>
          <span className={styles.muted}>{tb.thisMonth}</span>
          <strong>{nf.format(b.thisMonth)}</strong>
          <span className={styles.muted}>{last(b.lastMonth)}</span>
        </div>
        <div className={`${styles.card} ${styles.kpi}`}>
          <span className={styles.muted}>{tb.confirmedThisMonth}</span>
          <strong>{nf.format(b.confirmedThisMonth)}</strong>
        </div>
        <div className={`${styles.card} ${styles.kpi}`}>
          <span className={styles.muted}>{tb.waiting}</span>
          <strong>{nf.format(b.waiting)}</strong>
        </div>
        <div className={`${styles.card} ${styles.kpi}`}>
          <span className={styles.muted}>{tb.rate}</span>
          <strong>{b.confirmRate === null ? "—" : `${nf.format(b.confirmRate)} %`}</strong>
          <span className={styles.muted}>{tb.rateHint}</span>
        </div>
        <div className={`${styles.card} ${styles.kpi}`}>
          <span className={styles.muted}>{t.activeAgents}</span>
          <strong>{nf.format(activeAgents(rows))}</strong>
        </div>
      </div>
      <BookingsChart lang={lang} points={bookingsByMonth(bookingRows, now)} t={{ ...tb.chart, tableView: t.tableView, month: t.month }} />
      <p className={styles.muted}>{t.bookingsSoon}</p>
    </>
  );
}

/** Booking requests nobody has called back yet. */
async function BookingsBanner({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const waiting = await countNewBookings(lang);
  if (!waiting) return null;
  return (
    <p className={`${styles.notice} ${styles.warn}`} role="status">
      {dict.staff.overview.newBookings} : <strong>{waiting}</strong> ·{" "}
      <Link href={`${staffPath(lang, "reservations")}?statut=new`}>{dict.staff.bookings.title}</Link>
    </p>
  );
}

/** Direction only: removal requests waiting for this boss's decision. */
async function PendingBanner({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const { user } = await requireStaff(lang, { permission: "reports.view" });
  if (user.role !== "direction") return null;
  const waiting = (await listPendingRemovals(lang)).filter((r) => r.requested_by !== user.id).length;
  if (!waiting) return null;
  const t = dict.staff.employees;
  return (
    <p className={`${styles.notice} ${styles.warn}`} role="status">
      {t.pendingBanner.replace("{n}", String(waiting))} <Link href={staffPath(lang, "employes")}>{t.pendingLink}</Link>
    </p>
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
      <Suspense fallback={null}>
        <PendingBanner lang={lang} dict={dict} />
      </Suspense>
      <Suspense fallback={null}>
        <BookingsBanner lang={lang} dict={dict} />
      </Suspense>
      <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
        <Overview lang={lang} dict={dict} />
      </Suspense>
    </StaffShell>
  );
}
