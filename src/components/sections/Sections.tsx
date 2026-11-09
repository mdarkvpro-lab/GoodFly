import Image from "next/image";
import { AGENCY, agencyWhatsApp } from "@/config/site";
import { SERVICE_SLUGS } from "@/lib/bookings/validate";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { Icon, type IconName } from "@/components/Icon";
import { Reveal } from "@/components/motion/Reveal";
import styles from "./Sections.module.css";

type Props = { dict: Dictionary };

const serviceIcons: IconName[] = ["plane", "home", "passport"];
const SERVICE_ORDER = ["flight", "stay", "visa"] as const;

export function Services({ dict, lang }: Props & { lang: Locale }) {
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
            <span className={styles.serviceIcon}>
              <Icon name={serviceIcons[i]} size={28} />
            </span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            <a href={`/${lang}/services/${SERVICE_SLUGS[SERVICE_ORDER[i]]}`} className={styles.more}>
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

export function FinalCta({ dict, lang }: Props & { lang: Locale }) {
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
          <a href={agencyWhatsApp(lang)} className={styles.ghostButton} target="_blank" rel="noopener noreferrer">
            {t.whatsapp}
          </a>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer({ dict, lang }: Props & { lang: Locale }) {
  const t = dict.footer;
  const nav = dict.nav;
  const wa = agencyWhatsApp(lang);
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerRow}`}>
        <div className={styles.footerBrand}>
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny pre-sized logo */}
          <img className={styles.footerLogo} src="/brand/goodfly-logo.webp" width={86} height={48} alt="GoodFly" />
          <address className={styles.footerContact}>
            <span dir="auto">{AGENCY.address[lang]}</span>
            <span>
              {AGENCY.phones.map((ph, i) => (
                <span key={ph.tel}>
                  {i > 0 && " · "}
                  <a href={`tel:${ph.tel}`} dir="ltr">
                    {ph.display}
                  </a>
                </span>
              ))}
            </span>
            <span>
              <a href={`mailto:${AGENCY.email}`} dir="ltr">
                {AGENCY.email}
              </a>
            </span>
          </address>
        </div>
        <nav aria-label={t.explore} className={styles.footerNav}>
          <a href={`/${lang}#destinations`}>{nav.destinations}</a>
          <a href={`/${lang}/services/vols`}>{nav.flights}</a>
          <a href={`/${lang}/services/sejours`}>{nav.stays}</a>
        </nav>
        <nav aria-label={t.info} className={styles.footerNav}>
          <a href={wa} target="_blank" rel="noopener noreferrer">
            {t.contactLink}
          </a>
          <a href={`/${lang}/mentions-legales`}>{t.legal}</a>
          <a href={`/${lang}/confidentialite`}>{t.privacy}</a>
          <a href={`/${lang}/espace/connexion`}>{t.staff}</a>
        </nav>
      </div>
    </footer>
  );
}
