import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { Header } from "@/components/header/Header";
import { Footer } from "@/components/sections/Sections";
import { agencyWhatsApp } from "@/config/site";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { SERVICE_SLUGS, serviceFromSlug, type Service } from "@/lib/bookings/validate";
import styles from "./services.module.css";

const ICONS: Record<Service, IconName> = { flight: "plane", stay: "home", visa: "passport" };

export function generateStaticParams() {
  return locales.flatMap((lang) => Object.values(SERVICE_SLUGS).map((service) => ({ lang, service })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/services/[service]">): Promise<Metadata> {
  const { lang, service: slug } = await params;
  const service = serviceFromSlug(slug);
  if (!isLocale(lang) || !service) return {};
  const t = (await getDictionary(lang)).servicePages.items[service];
  return {
    title: `${t.title} · GoodFly`,
    description: t.intro,
    alternates: { languages: { fr: `/fr/services/${slug}`, ar: `/ar/services/${slug}` } },
  };
}

/** One page per service on the homepage; the button opens the request form for that service. */
export default async function ServicePage({ params }: PageProps<"/[lang]/services/[service]">) {
  const { lang, service: slug } = await params;
  const service = serviceFromSlug(slug);
  if (!isLocale(lang) || !service) notFound();
  const dict = await getDictionary(lang);
  const p = dict.servicePages;
  const t = p.items[service];
  return (
    <>
      <a href="#main" className="skip-link">
        {dict.nav.skipToContent}
      </a>
      <Header lang={lang} dict={dict} />
      <main id="main" className={`container ${styles.main}`}>
        <Link className={styles.back} href={`/${lang}#services`}>
          {p.back}
        </Link>
        <div className={styles.head}>
          <span className={styles.icon}>
            <Icon name={ICONS[service]} size={32} />
          </span>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h1 className="title-l">{t.title}</h1>
          <p className={styles.intro}>{t.intro}</p>
        </div>

        <div className={styles.layout}>
          <section aria-labelledby="what-title">
            <h2 id="what-title" className={styles.h2}>
              {p.whatTitle}
            </h2>
            <ul className={styles.points}>
              {t.points.map((point) => (
                <li key={point}>
                  <Icon name="check" size={20} className={styles.check} />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <p className={styles.note}>{t.note}</p>
          </section>

          <aside className={styles.aside} aria-labelledby="steps-title">
            <h2 id="steps-title" className={styles.h2}>
              {p.stepsTitle}
            </h2>
            <ol className={styles.steps}>
              {p.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <Link className={styles.cta} href={`/${lang}/reservation?service=${service}`}>
              {t.cta} <Icon name="arrow" size={18} className={styles.arrow} />
            </Link>
            <a className={styles.secondary} href={agencyWhatsApp(lang)} target="_blank" rel="noopener noreferrer">
              {p.whatsapp}
            </a>
          </aside>
        </div>
      </main>
      <Footer dict={dict} lang={lang} />
    </>
  );
}
