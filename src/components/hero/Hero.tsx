import { homeAirportLabel } from "@/config/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { BookingBar } from "./BookingBar";
import { HeroEmblem } from "./HeroEmblem";
import styles from "./Hero.module.css";

type Props = { lang: Locale; dict: Dictionary };

/** Welcome section: brand emblem, a clear promise, two next steps and the booking bar. */
export function Hero({ lang, dict }: Props) {
  const t = dict.hero;
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.clouds} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={`container ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={`eyebrow ${styles.line}`}>{t.eyebrow.replace("{airport}", homeAirportLabel(lang))}</p>
          <h1 id="hero-title" className={`title-xl ${styles.line}`}>
            {t.title}
          </h1>
          <p className={`${styles.subtitle} ${styles.line}`}>{t.subtitle}</p>
          <div className={`${styles.actions} ${styles.line}`}>
            <a href="#booking" className={styles.primary}>
              {t.ctaPrimary}
            </a>
            <a href="#destinations" className={styles.secondary}>
              {t.ctaSecondary}
              <span aria-hidden="true" className={styles.arrow}>
                →
              </span>
            </a>
          </div>
          <ul className={`${styles.highlights} ${styles.line}`} aria-label={t.highlightsLabel}>
            {t.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <HeroEmblem />
      </div>
      <div className={`container ${styles.bookingWrap}`}>
        <BookingBar lang={lang} dict={dict} />
      </div>
    </section>
  );
}
