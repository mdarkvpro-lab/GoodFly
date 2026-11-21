import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { Header } from "@/components/header/Header";
import styles from "@/components/programs/programs.module.css";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { Footer } from "@/components/sections/Sections";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { publicClient } from "@/lib/programs/data";

// Private page reached from the e-mail: never indexed, and the link is never sent to other sites.
export async function generateMetadata(): Promise<Metadata> {
  const lang = await rootLang();
  const dict = await getDictionary(isLocale(lang ?? "") ? (lang as Locale) : "fr");
  return { title: dict.reviewPage.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

type State = { state: "open" | "done" | "expired" | "invalid"; first_name: string | null; destination: string | null };

async function lookup(token: string): Promise<State> {
  const db = publicClient();
  const key = process.env.BOOKING_FORM_KEY;
  if (!db || !key || !/^[0-9a-f]{64}$/.test(token)) return { state: "invalid", first_name: null, destination: null };
  const { data, error } = await db.rpc("review_by_token", { form_key: key, token });
  const row = Array.isArray(data) ? (data[0] as State | undefined) : undefined;
  return !error && row ? row : { state: "invalid", first_name: null, destination: null };
}

async function Content({ lang, dict, params }: { lang: Locale; dict: Dictionary; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = dict.reviewPage;
  const r = await lookup(token);

  if (r.state !== "open") {
    const msg = {
      done: [t.doneAlreadyTitle, t.doneAlreadyText],
      expired: [t.expiredTitle, t.expiredText],
      invalid: [t.invalidTitle, t.invalidText],
    }[r.state];
    return (
      <div className={styles.head}>
        <h1 className="title-l">{msg[0]}</h1>
        <p className={styles.intro}>{msg[1]}</p>
        <Link className={styles.button} href={`/${lang}`}>
          {t.home}
        </Link>
      </div>
    );
  }

  const dest = r.destination ? (lang === "ar" ? ` إلى ${r.destination}` : ` à ${r.destination}`) : "";
  return (
    <>
      <div className={styles.head}>
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1 className="title-l" dir="auto">
          {t.title.replace("{dest}", dest)}
        </h1>
        {r.first_name && (
          <p className={styles.intro} dir="auto">
            {t.hello.replace("{name}", r.first_name)}
          </p>
        )}
      </div>
      <ReviewForm lang={lang} token={token} t={t} />
    </>
  );
}

export default async function ReviewPage({ params }: PageProps<"/[lang]/avis/[token]">) {
  const lang = await rootLang();
  if (!isLocale(lang ?? "")) notFound();
  const l = lang as Locale;
  const dict = await getDictionary(l);
  return (
    <>
      <a href="#main" className="skip-link">
        {dict.nav.skipToContent}
      </a>
      <Header lang={l} dict={dict} />
      <main id="main" className="container" style={{ maxWidth: 760, paddingBlock: "64px 120px" }}>
        <Suspense fallback={<p className={styles.intro}>{dict.staff.loading}</p>}>
          <Content lang={l} dict={dict} params={params} />
        </Suspense>
      </main>
      <Footer lang={l} dict={dict} />
    </>
  );
}
