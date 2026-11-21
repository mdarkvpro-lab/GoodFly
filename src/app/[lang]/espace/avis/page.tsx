import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice } from "@/components/staff/Notice";
import { StaffShell } from "@/components/staff/StaffShell";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { listReviews, REVIEW_STATUSES, staffPath, type ReviewStatus } from "@/lib/staff/dal";
import { moderateReview } from "./actions";

type Search = Record<string, string | string[] | undefined>;

const tagClass: Record<ReviewStatus, string> = {
  pending: styles.tagNew,
  approved: styles.tagOn,
  rejected: styles.tagOff,
  invited: styles.tagWarn,
};

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

async function Reviews({ lang, dict, searchParams }: { lang: Locale; dict: Dictionary; searchParams: Promise<Search> }) {
  const t = dict.staff.reviews;
  const q = await searchParams;
  const raw = Array.isArray(q.liste) ? q.liste[0] : q.liste;
  const list: ReviewStatus = (REVIEW_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as ReviewStatus) : "pending";
  const rows = await listReviews(lang, list);
  const date = new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" });
  const month = new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-MA", { month: "long", year: "numeric", timeZone: "UTC" });
  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />;
  const action = (id: string, decision: "approved" | "rejected", label: string, cls: string) => (
    <form action={moderateReview}>
      {hidden("lang", lang)}
      {hidden("id", id)}
      {hidden("list", list)}
      {hidden("decision", decision)}
      <button className={cls} type="submit">
        {label}
      </button>
    </form>
  );

  return (
    <>
      <nav aria-label={t.filterLabel} className={styles.filters}>
        {REVIEW_STATUSES.map((s) => (
          <Link key={s} href={`${staffPath(lang, "avis")}?liste=${s}`} aria-current={list === s}>
            {t.statuses[s]}
          </Link>
        ))}
      </nav>

      {rows.length === 0 && <p className={`${styles.card} ${styles.muted}`}>{t.empty}</p>}

      {rows.map((r) => {
        const trip = [r.destination, r.trip_month ? month.format(new Date(r.trip_month)) : ""].filter(Boolean).join(" · ");
        return (
          <article key={r.id} className={`${styles.card} ${styles.employee}`} aria-labelledby={`r-${r.id}`}>
            <div className={styles.employeeHead}>
              <div>
                <strong id={`r-${r.id}`}>
                  {r.rating ? (
                    <span aria-label={t.stars.replace("{n}", String(r.rating))} style={{ color: "var(--blue)", letterSpacing: 2 }}>
                      {stars(r.rating)}
                    </span>
                  ) : (
                    <span dir="ltr">{r.reference}</span>
                  )}
                </strong>
                <br />
                <span className={styles.muted}>
                  <span dir="ltr">{r.reference}</span> ·{" "}
                  {r.submitted_at ? t.received.replace("{date}", date.format(new Date(r.submitted_at))) : t.invitedOn.replace("{date}", date.format(new Date(r.invited_at)))}
                </span>
              </div>
              <span className={`${styles.tag} ${tagClass[r.status]}`}>{t.statuses[r.status]}</span>
            </div>

            <dl className={styles.facts}>
              {trip && (
                <div>
                  <dt>{t.trip}</dt>
                  <dd dir="auto">{trip}</dd>
                </div>
              )}
              {r.status !== "invited" && (
                <div>
                  <dt>{t.name}</dt>
                  <dd dir="auto">{r.show_name ? r.display_name : <span className={styles.muted}>{t.nameHidden}</span>}</dd>
                </div>
              )}
            </dl>

            {r.status !== "invited" && (
              <p className={styles.quote} dir="auto">
                {r.comment || <span className={styles.muted}>{t.noComment}</span>}
              </p>
            )}
            {r.rating !== null && r.rating <= 2 && r.status === "pending" && <p className={`${styles.notice} ${styles.error}`}>{t.low}</p>}

            {r.status !== "invited" && (
              <div className={styles.row}>
                {r.status !== "approved" && action(r.id, "approved", t.approve, styles.button)}
                {r.status === "pending" && action(r.id, "rejected", t.reject, styles.danger)}
                {r.status === "approved" && action(r.id, "rejected", t.unpublish, styles.danger)}
              </div>
            )}
          </article>
        );
      })}
    </>
  );
}

export default async function ReviewsPage({ params, searchParams }: PageProps<"/[lang]/espace/avis">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <StaffShell lang={lang} dict={dict}>
      <h1 className={styles.h1}>{dict.staff.reviews.title}</h1>
      <p className={styles.muted}>{dict.staff.reviews.intro}</p>
      <Suspense fallback={null}>
        <Notice searchParams={searchParams} dict={dict} />
      </Suspense>
      <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
        <Reviews lang={lang} dict={dict} searchParams={searchParams} />
      </Suspense>
    </StaffShell>
  );
}
