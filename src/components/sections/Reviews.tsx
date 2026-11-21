import styles from "@/components/reviews/reviews.module.css";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getPublicReviews } from "@/lib/reviews/data";

/** Reviews from real clients after their trip, approved by the agency. Hidden while there are none. */
export async function Reviews({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  const reviews = await getPublicReviews();
  if (reviews.length === 0) return null;
  const t = dict.reviews;
  const month = new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-MA", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <section className={`container ${styles.section}`} aria-labelledby="reviews-title">
      <div className={styles.head}>
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h2 id="reviews-title" className="title-l">
          {t.title}
        </h2>
      </div>
      <ul className={styles.list} aria-label={t.listLabel}>
        {reviews.map((r) => (
          <li key={r.id}>
            <figure className={styles.card}>
              <span className={styles.rating} role="img" aria-label={t.rating.replace("{n}", String(r.rating))}>
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)}
              </span>
              {r.comment && (
                <blockquote className={styles.quote} dir="auto" lang={r.lang} style={{ margin: 0 }}>
                  {r.comment}
                </blockquote>
              )}
              <figcaption className={styles.who}>
                <strong dir="auto">{r.name || t.anonymous}</strong>
                {[r.destination, r.trip_month ? month.format(new Date(r.trip_month)) : ""].filter(Boolean).map((x) => (
                  <span key={x} dir="auto">
                    {" · "}
                    {x}
                  </span>
                ))}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
      <p className={styles.note}>{t.note}</p>
    </section>
  );
}
