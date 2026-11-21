"use client";

import Link from "next/link";

/** Last-resort page if even the main layout fails: plain HTML, both languages, no dependencies. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "15vh auto", padding: "0 16px", lineHeight: 1.6 }}>
        <h1>Un problème est survenu</h1>
        <p>La page n&apos;a pas pu s&apos;afficher. Réessayez dans un instant.</p>
        <p dir="rtl" lang="ar">
          حدث خطأ، تعذّر عرض الصفحة. أعد المحاولة بعد لحظات.
        </p>
        <p style={{ display: "flex", gap: 12 }}>
          <button type="button" onClick={() => retry()}>
            Réessayer · إعادة المحاولة
          </button>
          <Link href="/">GoodFly</Link>
        </p>
      </body>
    </html>
  );
}
