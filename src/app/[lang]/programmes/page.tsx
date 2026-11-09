import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header/Header";
import { programFacts, programText } from "@/components/programs/format";
import styles from "@/components/programs/programs.module.css";
import { Footer } from "@/components/sections/Sections";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getPublishedPrograms, programImageUrl } from "@/lib/programs/data";

export async function generateMetadata({ params }: PageProps<"/[lang]/programmes">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).programs;
  return { title: t.metaTitle, description: t.intro, alternates: { languages: { fr: "/fr/programmes", ar: "/ar/programmes" } } };
}

export default async function ProgramsPage({ params }: PageProps<"/[lang]/programmes">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.programs;
  const programs = await getPublishedPrograms();

  return (
    <>
      <a href="#main" className="skip-link">
        {dict.nav.skipToContent}
      </a>
      <Header lang={lang} dict={dict} />
      <main id="main" className={`container ${styles.main}`}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h1 className="title-l">{t.title}</h1>
          <p className={styles.intro}>{t.intro}</p>
        </div>
        {programs.length === 0 ? (
          <div className={styles.empty}>
            <p>{t.empty}</p>
            <Link className={styles.button} href={`/${lang}/reservation`}>
              {t.emptyCta}
            </Link>
          </div>
        ) : (
          <ul className={styles.grid} role="list">
            {programs.map((p) => {
              const text = programText(p, lang);
              const facts = programFacts(p, lang, t);
              const img = programImageUrl(p.image_path);
              return (
                <li key={p.id} className={styles.card}>
                  <div className={styles.media}>{img && <Image src={img} alt="" fill sizes="(max-width: 700px) 100vw, 400px" />}</div>
                  <div className={styles.body}>
                    {p.destination && <p className={styles.eyebrow}>{p.destination}</p>}
                    <h2>
                      <Link href={`/${lang}/programmes/${p.slug}`} dir="auto">
                        {text.title}
                      </Link>
                    </h2>
                    {text.summary && (
                      <p className={styles.summary} dir="auto">
                        {text.summary}
                      </p>
                    )}
                    <ul className={styles.facts} role="list">
                      {facts.dates && <li>{facts.dates}</li>}
                      {facts.days && <li>{facts.days}</li>}
                      {facts.price && <li className={styles.price}>{facts.price}</li>}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer dict={dict} lang={lang} />
    </>
  );
}
