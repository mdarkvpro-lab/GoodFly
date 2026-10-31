import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Header } from "@/components/header/Header";
import { isLocale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import styles from "./reservation.module.css";

type Search = Record<string, string | string[] | undefined>;

async function Summary({ searchParams, dict }: { searchParams: Promise<Search>; dict: Dictionary }) {
  const query = await searchParams;
  const value = (key: string) => {
    const v = query[key];
    const text = (Array.isArray(v) ? v[0] : v)?.trim();
    return text ? text.slice(0, 120) : dict.reservation.empty;
  };
  const b = dict.booking;
  const rows: [string, string][] = [
    [b.from, value("from")],
    [b.to, value("to")],
    [b.dates, value("dates")],
    [b.travellers, value("travellers")],
  ];
  return (
    <dl className={styles.list}>
      {rows.map(([label, v]) => (
        <div key={label} className={styles.row}>
          <dt>{label}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Temporary page until the Supabase booking flow ships (phase 5). Nothing is stored yet. */
export default async function ReservationPage({ params, searchParams }: PageProps<"/[lang]/reservation">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <>
      <Header lang={lang} dict={dict} />
      <main className={`container ${styles.main}`}>
        <h1 className="title-l">{dict.reservation.title}</h1>
        <p className={styles.intro}>{dict.reservation.intro}</p>
        <Suspense fallback={<div className={styles.list} aria-busy="true" />}>
          <Summary searchParams={searchParams} dict={dict} />
        </Suspense>
        <Link href={`/${lang}`} className={styles.back}>
          {dict.reservation.back}
        </Link>
      </main>
    </>
  );
}
