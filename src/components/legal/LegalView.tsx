import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Header } from "@/components/header/Header";
import { Footer } from "@/components/sections/Sections";
import { LEGAL_PATHS, legalContent, type LegalKind } from "@/content/legal";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./legal.module.css";

/** "{{…}}" marks information the agency still has to give: shown highlighted so it is never forgotten. */
function withTodos(text: string): ReactNode {
  return text.split(/(\{\{[^}]+\}\})/).map((part, i) =>
    part.startsWith("{{") ? (
      <mark key={i} className={styles.todo}>
        {part.slice(2, -2)}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function LegalView({ lang, dict, kind }: { lang: Locale; dict: Dictionary; kind: LegalKind }) {
  const page = legalContent(lang, kind);
  const other: LegalKind = kind === "mentions" ? "privacy" : "mentions";
  return (
    <>
      <a href="#main" className="skip-link">
        {dict.nav.skipToContent}
      </a>
      <Header lang={lang} dict={dict} />
      <main id="main" className={`container ${styles.main}`}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>{page.eyebrow}</p>
          <h1 className="title-l">{page.title}</h1>
          <p className={styles.intro}>{page.intro}</p>
          <p className={styles.updated}>{page.updated}</p>
        </header>

        <div className={styles.layout}>
          <nav className={styles.toc} aria-label={page.title}>
            <ol>
              {page.sections.map((s, i) => (
                <li key={s.title}>
                  <a href={`#s${i + 1}`}>{s.title}</a>
                </li>
              ))}
            </ol>
            <Link className={styles.other} href={`/${lang}/${LEGAL_PATHS[other]}`}>
              {other === "privacy" ? dict.footer.privacy : dict.footer.legal}
            </Link>
          </nav>

          <div className={styles.body}>
            {page.sections.map((s, i) => (
              <section key={s.title} id={`s${i + 1}`} className={styles.section} aria-labelledby={`s${i + 1}-title`}>
                <h2 id={`s${i + 1}-title`}>
                  <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                {s.paragraphs?.map((p) => <p key={p}>{withTodos(p)}</p>)}
                {s.list && (
                  <ul>
                    {s.list.map((item) => (
                      <li key={item}>{withTodos(item)}</li>
                    ))}
                  </ul>
                )}
                {s.after?.map((p) => <p key={p}>{withTodos(p)}</p>)}
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer dict={dict} lang={lang} />
    </>
  );
}
