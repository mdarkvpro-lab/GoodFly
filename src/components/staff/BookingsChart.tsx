"use client";

import { useEffect, useRef, useState } from "react";
import type { BookingPoint } from "@/lib/staff/stats";
import styles from "./staff.module.css";

type T = { title: string; requests: string; confirmed: string; tableView: string; month: string };

const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 32 };

/** Requests and confirmed bookings per month: two lines on one axis, hover tooltip, table view. */
export function BookingsChart({ lang, points, t }: { lang: "fr" | "ar"; points: BookingPoint[]; t: T }) {
  const [hover, setHover] = useState<number | null>(null);
  // Real pixel width, so text and dots are never stretched.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = W < 520;
  const locale = lang === "ar" ? "ar-MA" : "fr-MA";
  const short = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const long = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const date = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
  };
  const nf = new Intl.NumberFormat(locale);

  const max = Math.max(4, ...points.map((p) => p.requests));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const line = (k: "requests" | "confirmed") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  const h = hover !== null ? points[hover] : null;

  return (
    <section className={`${styles.card} ${styles.bookingsChart}`} aria-labelledby="bookings-chart">
      <div className={styles.row} style={{ justifyContent: "space-between" }}>
        <h2 id="bookings-chart" style={{ fontSize: 18 }}>
          {t.title}
        </h2>
        <div className={styles.legend}>
          <span>
            <span className={`${styles.swatch} ${styles.seriesRequests}`} aria-hidden="true" />
            {t.requests}
          </span>
          <span>
            <span className={`${styles.swatch} ${styles.seriesConfirmed}`} aria-hidden="true" />
            {t.confirmed}
          </span>
        </div>
      </div>

      {/* The chart reads left to right in both languages (time axis). */}
      <div ref={box} className={styles.lineChart} dir="ltr" onMouseLeave={() => setHover(null)}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.title}>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line className={styles.gridLine} x1={PAD.left} x2={W - PAD.right} y1={y(i * step)} y2={y(i * step)} />
              <text className={styles.axisText} x={PAD.left - 8} y={y(i * step) + 4} textAnchor="end">
                {nf.format(i * step)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            narrow && (last - i) % 2 ? null : (
              <text key={p.key} className={styles.axisText} x={x(i)} y={H - 8} textAnchor="middle">
                {short.format(date(p.key))}
              </text>
            ),
          )}
          {hover !== null && <line className={styles.crosshair} x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} />}
          <path className={styles.lineRequests} d={line("requests")} />
          <path className={styles.lineConfirmed} d={line("confirmed")} />
          {/* End points carry identity without relying on color alone. */}
          <circle className={styles.dotRequests} cx={x(last)} cy={y(points[last].requests)} r={4} />
          <circle className={styles.dotConfirmed} cx={x(last)} cy={y(points[last].confirmed)} r={4} />
          {hover !== null && (
            <>
              <circle className={styles.dotRequests} cx={x(hover)} cy={y(points[hover].requests)} r={5} />
              <circle className={styles.dotConfirmed} cx={x(hover)} cy={y(points[hover].confirmed)} r={5} />
            </>
          )}
          {points.map((p, i) => (
            <rect
              key={p.key}
              className={styles.hitArea}
              x={x(i) - innerW / (2 * Math.max(1, last))}
              y={PAD.top}
              width={innerW / Math.max(1, last)}
              height={innerH}
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          ))}
        </svg>
        {h && hover !== null && (
          <div className={styles.chartTip} style={{ left: `${Math.min(Math.max(x(hover), 90), W - 90)}px` }} role="status">
            <strong>{long.format(date(h.key))}</strong>
            <span>
              <span className={`${styles.swatch} ${styles.seriesRequests}`} aria-hidden="true" /> {t.requests} : {nf.format(h.requests)}
            </span>
            <span>
              <span className={`${styles.swatch} ${styles.seriesConfirmed}`} aria-hidden="true" /> {t.confirmed} : {nf.format(h.confirmed)}
            </span>
          </div>
        )}
      </div>

      <details className={styles.details}>
        <summary>{t.tableView}</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table} style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th scope="col">{t.month}</th>
                <th scope="col">{t.requests}</th>
                <th scope="col">{t.confirmed}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.key}>
                  <td>{long.format(date(p.key))}</td>
                  <td>{nf.format(p.requests)}</td>
                  <td>{nf.format(p.confirmed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
