"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import styles from "@/components/programs/programs.module.css";

// Kept here (not in the dictionaries, which load on the server only) so the page works even when the server failed.
const TEXT = {
  fr: {
    title: "Un problème est survenu",
    text: "La page n'a pas pu s'afficher. Réessayez dans un instant ; si le problème continue, contactez l'agence par téléphone ou WhatsApp.",
    retry: "Réessayer",
    home: "Retour à l'accueil",
  },
  ar: {
    title: "حدث خطأ",
    text: "تعذّر عرض الصفحة. أعد المحاولة بعد لحظات؛ وإذا استمر المشكل، تواصل مع الوكالة عبر الهاتف أو واتساب.",
    retry: "إعادة المحاولة",
    home: "العودة إلى الرئيسية",
  },
} as const;

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const params = useParams<{ lang?: string }>();
  const lang = params?.lang === "ar" ? "ar" : "fr";
  const t = TEXT[lang];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className={`container ${styles.main}`}>
      <div className={styles.head}>
        <h1 className="title-l">{t.title}</h1>
        <p className={styles.intro}>{t.text}</p>
        <p style={{ display: "flex", flexWrap: "wrap", gap: "12px 24px", alignItems: "center" }}>
          <button type="button" className={styles.button} onClick={() => retry()}>
            {t.retry}
          </button>
          <Link className={styles.back} href={`/${lang}`}>
            {t.home}
          </Link>
        </p>
      </div>
    </main>
  );
}
