import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./Header.module.css";

type Props = { lang: Locale; dict: Dictionary };

export function Header({ lang, dict }: Props) {
  const other: Locale = lang === "fr" ? "ar" : "fr";
  const t = dict.nav;

  return (
    <header className={styles.header}>
      <div className={`container ${styles.row}`}>
        <Link href={`/${lang}`} className={styles.logo} aria-label="GoodFly">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny pre-sized logo, no optimisation needed */}
          <img src="/brand/goodfly-logo.webp" width={86} height={48} alt="GoodFly" />
        </Link>
        <nav aria-label={t.label} className={styles.nav}>
          <a href={`/${lang}#destinations`}>{t.destinations}</a>
          <Link href={`/${lang}/programmes`}>{t.programs}</Link>
          <a href={`/${lang}#services`}>{t.flights}</a>
          <a href={`/${lang}#services`}>{t.stays}</a>
          <a href={`/${lang}#why`}>{t.agency}</a>
        </nav>
        <div className={styles.actions}>
          <Link href={`/${other}`} hrefLang={other} lang={other} className={styles.langButton} aria-label={t.switchLanguage}>
            <span aria-hidden="true">
              {t.currentLanguageShort} · <span className={styles.langOther}>{t.otherLanguageShort}</span>
            </span>
          </Link>
          <ThemeToggle label={t.toggleTheme} />
          <a href={`/${lang}#booking`} className={styles.book}>
            {t.book}
          </a>
        </div>
      </div>
    </header>
  );
}
