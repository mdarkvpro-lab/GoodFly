"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { AIRPORT_COORDS } from "@/config/site";
import type { Locale } from "@/i18n/config";
import { gsap, registerGsap, ScrollTrigger, useGSAP, usePrefersReducedMotion } from "@/lib/motion";
import styles from "./Sections.module.css";

registerGsap();

type Item = {
  id: string;
  code: string;
  name: string;
  photo: string;
  image: string;
  confirmed: boolean;
  km: number | null;
  distanceText: string;
};

type Props = {
  eyebrow: string;
  title: string;
  unconfirmed: string;
  listLabel: string;
  routeLabel: string;
  items: Item[];
  dir: "ltr" | "rtl";
  lang: Locale;
  origin: { code: string; name: string };
};

// Simple map projection of the region (Atlantic → Gulf) into the 600×300 route box.
const BOX = { w: 600, lon0: -10, lon1: 60, lat0: 20, lat1: 52 };
function project(code: string, mirror: boolean) {
  const c = AIRPORT_COORDS[code] ?? { lat: 35, lon: 0 };
  const x = 60 + ((c.lon - BOX.lon0) / (BOX.lon1 - BOX.lon0)) * 480;
  const y = 70 + ((BOX.lat1 - c.lat) / (BOX.lat1 - BOX.lat0)) * 190;
  return { x: mirror ? BOX.w - x : x, y };
}

/**
 * Curved route: the control point sits on the perpendicular of the chord, on the upper side,
 * so short and long, steep and flat routes all get the same graceful arc.
 */
function routePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  let nx = -dy / dist;
  let ny = dx / dist;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const bend = dist * 0.32;
  const cx = (a.x + b.x) / 2 + nx * bend;
  const cy = Math.max(14, (a.y + b.y) / 2 + ny * bend);
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

const PLANE = "M18 0 L5 -2 L-5 -15 L-9.5 -15 L-4 -2 L-12 -2 L-16 -7.5 L-19 -7.5 L-16.5 0 L-19 7.5 L-16 7.5 L-12 2 L-4 2 L-9.5 15 L-5 15 L5 2 Z";

export function Destinations({ eyebrow, title, unconfirmed, listLabel, routeLabel, items, dir, lang, origin }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const planeRef = useRef<SVGGElement>(null);
  const [active, setActive] = useState(1);
  const reduced = usePrefersReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const rtl = dir === "rtl";

  const current = items[active];
  const a = project(origin.code, rtl);
  const b = project(current.code, rtl);
  const path = routePath(a, b);
  // fr-FR groups thousands with a space (3 200 km), as French readers expect.
  const nf = new Intl.NumberFormat(lang === "ar" ? "ar-MA" : "fr-FR", { useGrouping: "always" });

  // Desktop: scrolling through the pinned section moves through the destinations.
  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section || reduced) return;
      const st = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => setActive(Math.min(items.length - 1, Math.floor(self.progress * items.length))),
      });
      return () => st.kill();
    },
    { dependencies: [reduced, items.length], revertOnUpdate: true },
  );

  // Each time the destination changes, the route draws itself and the plane flies along it.
  useGSAP(
    () => {
      const line = progressRef.current;
      const glow = glowRef.current;
      const plane = planeRef.current;
      if (!line || !glow || !plane) return;
      const length = line.getTotalLength();
      // t = how much of the route is drawn; the plane rides the tip (or sits mid-route when motion is reduced).
      const draw = (t: number, planeT = t) => {
        const offset = `${length * (1 - t)}`;
        for (const p of [line, glow]) {
          p.style.strokeDasharray = `${length}`;
          p.style.strokeDashoffset = offset;
        }
        const at = line.getPointAtLength(length * planeT);
        const ahead = line.getPointAtLength(Math.min(length, length * planeT + 1));
        const behind = line.getPointAtLength(Math.max(0, length * planeT - 1));
        const angle = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;
        plane.setAttribute("transform", `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(0.85)`);
        // Fades in after take-off and out on landing, leaving the destination pin clear.
        plane.style.opacity = planeT < 0.02 || planeT > 0.97 ? "0" : "1";
      };
      if (reduced) {
        draw(1, 0.6);
        return;
      }
      const state = { t: 0 };
      draw(0);
      gsap.to(state, { t: 1, duration: 1.8, ease: "power2.inOut", onUpdate: () => draw(state.t) });
    },
    { dependencies: [active, reduced, path], revertOnUpdate: true },
  );

  return (
    <section
      id="destinations"
      ref={sectionRef}
      className={styles.destinations}
      data-motion={reduced ? "off" : "on"}
      aria-labelledby="destinations-title"
    >
      <div className={styles.destSticky}>
        <div className={`container ${styles.destGrid}`}>
          <div className={styles.destCopy}>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id="destinations-title" className="title-l">
              {title}
            </h2>
            {items.some((i) => !i.confirmed) && <p className={styles.badge}>{unconfirmed}</p>}
            <ul className={styles.destList} aria-label={listLabel}>
              {items.map((item, i) => (
                <li key={item.id}>
                  <button type="button" className={styles.destButton} aria-pressed={i === active} onClick={() => setActive(i)}>
                    <span className={styles.destDot} aria-hidden="true" />
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <figure className={styles.destMedia}>
            {items.map((item, i) => (
              <div key={item.id} className={styles.destPhoto} data-active={i === active} aria-hidden={i !== active}>
                <Image
                  src={item.image}
                  alt={i === active ? item.photo : ""}
                  fill
                  sizes="(max-width: 900px) 100vw, 50vw"
                  className={styles.destImage}
                  loading={i === active ? "eager" : "lazy"}
                />
              </div>
            ))}

            {/* Flight card: route codes, cities and the real great-circle distance */}
            <div className={styles.routeCard} aria-live="polite">
              <p className={styles.routeLabel}>{routeLabel}</p>
              {/* Follows the reading direction: in Arabic the origin sits on the right and the arrow points left */}
              <p className={styles.routeCodes}>
                <span>{origin.code}</span>
                <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true" className={styles.routeArrow}>
                  <path d="M1 6h18M14 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{current.code}</span>
              </p>
              <p className={styles.routeCities}>
                {origin.name} {rtl ? "←" : "→"} {current.name}
              </p>
              {current.km !== null && <p className={styles.routeKm}>{current.distanceText.replace("{km}", nf.format(current.km))}</p>}
            </div>

            <svg className={styles.arc} viewBox="0 0 600 300" aria-hidden="true">
              <defs>
                <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
                  <stop offset="0" stopColor="#5cb6ff" />
                  <stop offset="1" stopColor="#f8f808" />
                </linearGradient>
                <filter id={`${gradientId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" />
                </filter>
              </defs>

              {/* Full route, faint and dotted */}
              <path d={path} fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.6" strokeDasharray="1 8" strokeLinecap="round" />
              {/* Travelled part: soft glow + gradient line */}
              <path ref={glowRef} d={path} fill="none" stroke={`url(#${gradientId})`} strokeWidth="7" strokeLinecap="round" opacity="0.55" filter={`url(#${gradientId}-glow)`} />
              <path ref={progressRef} d={path} fill="none" stroke={`url(#${gradientId})`} strokeWidth="3" strokeLinecap="round" />

              {/* Origin: pulsing ring */}
              <circle className={styles.pulse} cx={a.x} cy={a.y} r="7" fill="none" stroke="#5cb6ff" strokeWidth="2" />
              <circle cx={a.x} cy={a.y} r="6" fill="#0858f8" stroke="#ffffff" strokeWidth="2" />
              <text x={a.x} y={a.y + 30} textAnchor="middle" className={styles.arcLabel}>
                {origin.code}
              </text>

              {/* Destination pin */}
              <circle cx={b.x} cy={b.y} r="12" fill="#f8f808" opacity="0.25" />
              <circle cx={b.x} cy={b.y} r="6.5" fill="#f8f808" stroke="#ffffff" strokeWidth="2" />
              <text x={b.x} y={b.y + 30} textAnchor="middle" className={styles.arcLabel}>
                {current.code}
              </text>

              {/* The plane flies along the route */}
              <g ref={planeRef} className={styles.routePlane} style={{ opacity: 0 }}>
                <path d={PLANE} fill="#ffffff" />
              </g>
            </svg>

            <figcaption className={styles.destCaption}>{current.photo}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
