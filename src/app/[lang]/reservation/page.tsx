import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingForm } from "@/components/booking/BookingForm";
import formStyles from "@/components/booking/booking.module.css";
import { Header } from "@/components/header/Header";
import { programFacts, programText } from "@/components/programs/format";
import { Footer } from "@/components/sections/Sections";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { prefillFromSearch } from "@/lib/bookings/validate";
import { getPublishedProgram, programImageUrl } from "@/lib/programs/data";
import styles from "./reservation.module.css";

type Search = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: PageProps<"/[lang]/reservation">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  // Personal form with query-string variants: keep it out of search results.
  return { title: `${dict.reservation.title} · GoodFly`, robots: { index: false, follow: true } };
}

/** The form, prefilled from the homepage search bar or from a programme (?programme=slug). */
async function Request({ lang, dict, searchParams }: { lang: Locale; dict: Dictionary; searchParams: Promise<Search> }) {
  const initial = prefillFromSearch(await searchParams);
  const program = initial.program ? await getPublishedProgram(initial.program) : null;
  const t = dict.reservation;
  if (initial.program && !program) initial.program = "";
  const img = program ? programImageUrl(program.image_path) : null;
  const facts = program ? programFacts(program, lang, dict.programs) : null;
  return (
    <>
      {program && (
        <div className={formStyles.program}>
          <div className={formStyles.programMedia}>{img && <Image src={img} alt="" fill sizes="120px" />}</div>
          <div>
            <p className={styles.eyebrow}>{t.forProgram}</p>
            <h2 dir="auto">{programText(program, lang).title}</h2>
            <p>{[facts?.dates, facts?.days, facts?.price].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
      )}
      <BookingForm lang={lang} t={t.form} initial={{ ...initial, children: "0" }} programLocked={Boolean(program)} turnstileSiteKey={process.env.TURNSTILE_SITE_KEY || undefined} />
    </>
  );
}

export default async function ReservationPage({ params, searchParams }: PageProps<"/[lang]/reservation">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <>
      <a href="#main" className="skip-link">
        {dict.nav.skipToContent}
      </a>
      <Header lang={lang} dict={dict} />
      <main id="main" className={`container ${styles.main}`}>
        <h1 className="title-l">{dict.reservation.title}</h1>
        <p className={styles.intro}>{dict.reservation.intro}</p>
        <Suspense fallback={<p className={styles.intro}>{dict.staff.loading}</p>}>
          <Request lang={lang} dict={dict} searchParams={searchParams} />
        </Suspense>
      </main>
      <Footer dict={dict} lang={lang} />
    </>
  );
}
