import type { Locale } from "@/i18n/config";
import type { MonthPoint } from "@/lib/staff/stats";
import styles from "./staff.module.css";

type Props = {
  lang: Locale;
  points: MonthPoint[];
  t: { chartTitle: string; gained: string; lost: string; tableView: string; month: string };
};

/** Gained (up, blue) and lost (down, ochre) clients per month, with a table view for screen readers and exact values. */
export function ClientsChart({ lang, points, t }: Props) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.gained, p.lost)));
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-MA", { month: "short", timeZone: "UTC" });
  const fmtLong = new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-MA", { month: "long", year: "numeric", timeZone: "UTC" });
  const label = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return { short: fmt.format(d), long: fmtLong.format(d) };
  };

  return (
    <section className={styles.card} aria-labelledby="clients-chart">
      <div className={styles.row} style={{ justifyContent: "space-between" }}>
        <h2 id="clients-chart" style={{ fontSize: 18 }}>
          {t.chartTitle}
        </h2>
        <div className={styles.legend}>
          <span>
            <span className={`${styles.swatch} ${styles.gained}`} aria-hidden="true" />
            {t.gained}
          </span>
          <span>
            <span className={`${styles.swatch} ${styles.lost}`} aria-hidden="true" />
            {t.lost}
          </span>
        </div>
      </div>
      <div className={styles.chart} aria-hidden="true">
        {points.map((p) => {
          const l = label(p.key);
          return (
            <div key={p.key} className={styles.col} title={`${l.long} — ${t.gained} : ${p.gained} · ${t.lost} : ${p.lost}`}>
              <div className={styles.up}>
                <div className={styles.bar} style={{ height: `${(p.gained / max) * 100}%` }} />
              </div>
              <div className={styles.down}>
                <div className={styles.barLost} style={{ height: `${(p.lost / max) * 100}%` }} />
              </div>
              <span className={styles.monthLabel}>{l.short}</span>
            </div>
          );
        })}
      </div>
      <details className={styles.details}>
        <summary>{t.tableView}</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table} style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th scope="col">{t.month}</th>
                <th scope="col">{t.gained}</th>
                <th scope="col">{t.lost}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.key}>
                  <td>{label(p.key).long}</td>
                  <td>{p.gained}</td>
                  <td>{p.lost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
