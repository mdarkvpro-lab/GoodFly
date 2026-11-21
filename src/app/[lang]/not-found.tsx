import type { Metadata } from "next";
import Link from "next/link";
import { lang as rootLang } from "next/root-params";
import { Header } from "@/components/header/Header";
import styles from "@/components/programs/programs.module.css";
import { Footer } from "@/components/sections/Sections";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export const metadata: Metadata = { title: "404 · GoodFly" };

/** The site's 404 page, in the visitor's language, with the usual header and footer. */
export default async function NotFound() {
  const param = await rootLang();
  const lang = param && isLocale(param) ? param : defaultLocale;
  const dict = await getDictionary(lang);
  const t = dict.notFound;
  return (
    <>
      <a href="#main" className="skip-link">
        {dict.nav.skipToContent}
      </a>
      <Header lang={lang} dict={dict} />
      <main id="main" className={`container ${styles.main}`}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>404</p>
          <h1 className="title-l">{t.title}</h1>
          <p className={styles.intro}>{t.text}</p>
          <p style={{ display: "flex", flexWrap: "wrap", gap: "12px 24px", alignItems: "center" }}>
            <Link className={styles.button} href={`/${lang}`}>
              {t.home}
            </Link>
            <Link className={styles.back} href={`/${lang}/programmes`}>
              {t.programs}
            </Link>
          </p>
        </div>
      </main>
      <Footer lang={lang} dict={dict} />
    </>
  );
}
