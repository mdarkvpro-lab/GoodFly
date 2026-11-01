import Image from "next/image";
import type { Dictionary } from "@/i18n/dictionaries";
import { Reveal } from "@/components/motion/Reveal";
import styles from "./Sections.module.css";

type Props = { dict: Dictionary };

const serviceIcons = [
  <path key="plane" d="M2 16l20-6-3-3-6 2-5-5-2 1 3 6-4 1-2-2-1 1 2 4z" />,
  <g key="home">
    <path d="M3 20V8l9-5 9 5v12" />
    <path d="M9 20v-6h6v6" />
  </g>,
  <g key="passport">
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <circle cx="12" cy="10" r="3" />
    <path d="M9 16h6" />
  </g>,
];

export function Services({ dict }: Props) {
  const t = dict.services;
  return (
    <section id="services" className={`container ${styles.section}`} aria-labelledby="services-title">
      <p className="eyebrow">{t.eyebrow}</p>
      <h2 id="services-title" className={`title-l ${styles.narrow}`}>
        {t.title}
      </h2>
      <Reveal className={styles.cards3}>
        {t.items.map((item, i) => (
          <article key={item.title} className={styles.card}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {serviceIcons[i]}
            </svg>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            <a href="#booking" className={styles.more}>
              {t.more} <span aria-hidden="true" className={styles.arrow}>→</span>
            </a>
          </article>
        ))}
      </Reveal>
    </section>
  );
}

export function Featured({ dict, href }: Props & { href: string }) {
  const t = dict.featured;
  return (
    <section className={`container ${styles.featuredWrap}`} aria-labelledby="featured-title">
      <div className={styles.featured}>
        <Image src="/images/featured-riad.jpg" alt={t.imageAlt} fill sizes="(max-width: 1264px) 100vw, 1200px" className={styles.featuredImage} />
        <div className={styles.featuredCopy}>
          <p className={styles.nightEyebrow}>{t.eyebrow}</p>
          <h2 id="featured-title">{t.title}</h2>
          <a href={href} className={styles.lightButton}>
            {t.cta}
          </a>
        </div>
      </div>
    </section>
  );
}

const CABIN_IMAGES = ["/images/cabin-economy.jpg", "/images/cabin-business.jpg"];

export function Comfort({ dict }: Props) {
  const t = dict.comfort;
  return (
    <section className={`container ${styles.section}`} aria-labelledby="comfort-title">
      <p className="eyebrow">{t.eyebrow}</p>
      <h2 id="comfort-title" className={`title-l ${styles.narrow}`}>
        {t.title}
      </h2>
      <Reveal className={styles.cards2}>
        {t.cabins.map((cabin, i) => (
          <article key={cabin.name} className={styles.cabin}>
            <div className={styles.cabinImage}>
              <Image src={CABIN_IMAGES[i]} alt={cabin.image} fill sizes="(max-width: 900px) 100vw, 600px" />
            </div>
            <div className={styles.cabinBody}>
              <h3>{cabin.name}</h3>
              <ul>
                {cabin.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </Reveal>
    </section>
  );
}

export function Why({ dict }: Props) {
  return (
    <section id="why" className={styles.why}>
      <Reveal className={`container ${styles.whyGrid}`}>
        {dict.why.items.map((item) => (
          <div key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}

const cityLights = [80, 140, 210, 290, 360, 430, 500, 580, 650, 720, 790, 860, 930, 1000, 1080, 1150, 1220, 1300, 1370];

export function FinalCta({ dict }: Props) {
  const t = dict.finalCta;
  return (
    <section className={styles.final} aria-labelledby="final-title">
      <div className={styles.finalGlow} aria-hidden="true" />
      <svg className={styles.cityLights} viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
        {cityLights.map((x, i) => (
          <circle key={x} cx={x} cy={84 + ((i * 7) % 20)} r={i % 3 === 0 ? 2.5 : 1.6} fill="var(--night-accent)" />
        ))}
        {[620, 660, 700, 740, 780, 820].map((x) => (
          <circle key={x} cx={x} cy={112} r={2} fill="#7fb0ff" opacity="0.7" />
        ))}
      </svg>
      <Reveal className={styles.finalCopy}>
        <p className={styles.nightEyebrow}>{t.eyebrow}</p>
        <h2 id="final-title" className="title-xl">
          {t.title}
        </h2>
        <p className={styles.finalSub}>{t.subtitle}</p>
        <div className={styles.finalActions}>
          <a href="#booking" className={styles.sunButton}>
            {t.plan}
          </a>
          <a href="#" className={styles.ghostButton}>
            {t.whatsapp}
          </a>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer({ dict }: Props) {
  const t = dict.footer;
  const nav = dict.nav;
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerRow}`}>
        <div className={styles.footerBrand}>
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny pre-sized logo */}
          <img className={styles.footerLogo} src="/brand/goodfly-logo.webp" width={86} height={48} alt="GoodFly" />
          <p>{t.contact}</p>
        </div>
        <nav aria-label={t.explore} className={styles.footerNav}>
          <a href="#destinations">{nav.destinations}</a>
          <a href="#services">{nav.flights}</a>
          <a href="#services">{nav.stays}</a>
        </nav>
        <nav aria-label={t.info} className={styles.footerNav}>
          <a href="#">{t.contactLink}</a>
          <a href="#">{t.legal}</a>
          <a href="#">{t.privacy}</a>
        </nav>
      </div>
    </footer>
  );
}
