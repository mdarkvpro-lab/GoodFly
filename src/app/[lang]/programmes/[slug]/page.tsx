import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { Header } from "@/components/header/Header";
import { programFacts, programText } from "@/components/programs/format";
import styles from "@/components/programs/programs.module.css";
import { Footer } from "@/components/sections/Sections";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { getPublishedProgram, programImageUrl } from "@/lib/programs/data";

export async function generateMetadata({ params }: PageProps<"/[lang]/programmes/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const p = await getPublishedProgram(slug);
  if (!p) return { robots: { index: false, follow: false } };
  const text = programText(p, lang);
  const img = programImageUrl(p.image_path);
  return {
    title: `${text.title} · GoodFly`,
    description: text.summary || undefined,
    openGraph: img ? { images: [img] } : undefined,
    alternates: { languages: { fr: `/fr/programmes/${p.slug}`, ar: `/ar/programmes/${p.slug}` } },
  };
}

async function Detail({ lang, dict, params }: { lang: Locale; dict: Dictionary; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPublishedProgram(slug);
  const t = dict.programs;
  if (!p) {
    // Unknown, unpublished or malformed address: localised message (noindex set in generateMetadata).
    return (
      <div className={styles.head}>
        <p className={styles.eyebrow}>404</p>
        <h1 className="title-l">{t.missingTitle}</h1>
        <p className={styles.intro}>{t.missingText}</p>
        <Link className={styles.back} href={`/${lang}/programmes`}>
          {t.back}
        </Link>
      </div>
    );
  }
  const text = programText(p, lang);
  const facts = programFacts(p, lang, t);
  const img = programImageUrl(p.image_path);
  return (
    <article>
      <Link className={styles.back} href={`/${lang}/programmes`}>
        {t.back}
      </Link>
      <div className={styles.hero}>{img && <Image src={img} alt="" fill priority sizes="(max-width: 1264px) 100vw, 1200px" />}</div>
      <div className={styles.layout}>
        <div className={styles.head}>
          {p.destination && <p className={styles.eyebrow}>{p.destination}</p>}
          <h1 className="title-l" dir="auto">{text.title}</h1>
          {text.summary && (
            <p className={styles.intro} dir="auto">
              {text.summary}
            </p>
          )}
          {text.description && <div className={styles.description} dir="auto">
              {text.description}
            </div>}
        </div>
        <aside className={styles.aside} aria-label={t.factsLabel}>
          {facts.price && <p className={styles.asidePrice}>{facts.price}</p>}
          <dl>
            {facts.dates && (
              <div>
                <dt>{t.dates}</dt>
                <dd>{facts.dates}</dd>
              </div>
            )}
            {facts.days && (
              <div>
                <dt>{t.duration}</dt>
                <dd>{facts.days}</dd>
              </div>
            )}
          </dl>
          <Link className={styles.asideButton} href={`/${lang}/reservation?programme=${p.slug}`}>
            {t.book}
          </Link>
        </aside>
      </div>
    </article>
  );
}

export default async function ProgramPage({ params }: PageProps<"/[lang]/programmes/[slug]">) {
  // The slug is only known at request time: the language comes from the root param, the slug inside Suspense.
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <>
      <a href="#main" className="skip-link">
        {dict.nav.skipToContent}
      </a>
      <Header lang={lang} dict={dict} />
      <main id="main" className={`container ${styles.main}`}>
        <Suspense fallback={<p className={styles.intro}>{dict.staff.loading}</p>}>
          <Detail lang={lang} dict={dict} params={params} />
        </Suspense>
      </main>
      <Footer dict={dict} lang={lang} />
    </>
  );
}
