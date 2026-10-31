"use client";

import { useRef, useState } from "react";
import { homeAirport } from "@/config/site";
import { registerGsap, ScrollTrigger, useGSAP, usePrefersReducedMotion } from "@/lib/motion";
import styles from "./Sections.module.css";

registerGsap();

type Item = { id: string; code: string; name: string; photo: string; confirmed: boolean };

type Props = {
  eyebrow: string;
  title: string;
  unconfirmed: string;
  listLabel: string;
  items: Item[];
  dir: "ltr" | "rtl";
};

// Arc end points in a 600×300 box (origin is the home airport).
const ORIGIN = { x: 70, y: 230 };
const ENDS = [
  { x: 520, y: 170 },
  { x: 540, y: 110 },
  { x: 430, y: 60 },
  { x: 560, y: 200 },
];

export function Destinations({ eyebrow, title, unconfirmed, listLabel, items, dir }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const arcRef = useRef<SVGPathElement>(null);
  const [active, setActive] = useState(1);
  const reduced = usePrefersReducedMotion();
  const mirror = (x: number) => (dir === "rtl" ? 600 - x : x);

  // Scroll drives which destination is active and how far the arc is drawn.
  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section || reduced) return;
      const apply = (progress: number) => {
        const index = Math.min(items.length - 1, Math.floor(progress * items.length));
        setActive(index);
        const arc = arcRef.current;
        if (!arc) return;
        // The arc's shape changes per destination, so measure it on every update.
        const length = arc.getTotalLength();
        const local = progress * items.length - index;
        arc.style.strokeDasharray = `${length}`;
        arc.style.strokeDashoffset = `${length * (1 - Math.min(1, local * 1.6))}`;
      };
      const st = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => apply(self.progress),
      });
      apply(st.progress);
      return () => {
        st.kill();
        const arc = arcRef.current;
        if (arc) {
          arc.style.strokeDasharray = "";
          arc.style.strokeDashoffset = "";
        }
      };
    },
    { dependencies: [reduced, items.length], revertOnUpdate: true },
  );

  const end = ENDS[active % ENDS.length];
  const ox = mirror(ORIGIN.x);
  const ex = mirror(end.x);
  const cx1 = mirror(200);
  const cx2 = mirror(420);
  const path = `M${ox} ${ORIGIN.y} C ${cx1} 40, ${cx2} 30, ${ex} ${end.y}`;
  const current = items[active];

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
                  <button
                    type="button"
                    className={styles.destButton}
                    aria-pressed={i === active}
                    onClick={() => setActive(i)}
                  >
                    <span className={styles.destDot} aria-hidden="true" />
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <figure className={styles.destMedia}>
            <svg className={styles.arc} viewBox="0 0 600 300" aria-hidden="true">
              <path ref={arcRef} d={path} fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" />
              <circle cx={ox} cy={ORIGIN.y} r="7" fill="var(--blue)" />
              <circle cx={ex} cy={end.y} r="7" fill="var(--accent)" />
              <text x={ox} y={ORIGIN.y + 34} textAnchor="middle" className={styles.arcLabel}>
                {homeAirport}
              </text>
              <text x={ex} y={end.y + 34} textAnchor="middle" className={styles.arcLabel}>
                {current.code}
              </text>
            </svg>
            {items.map((item, i) => (
              <div key={item.id} className={styles.destPhoto} data-active={i === active} aria-hidden={i !== active}>
                <figcaption>{item.photo}</figcaption>
              </div>
            ))}
          </figure>
        </div>
      </div>
    </section>
  );
}
