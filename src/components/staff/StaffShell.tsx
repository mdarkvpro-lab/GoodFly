import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/[lang]/espace/actions";
import { ThemeToggle } from "@/components/header/ThemeToggle";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { staffPath } from "@/lib/staff/dal";
import styles from "./staff.module.css";

type Props = { lang: Locale; dict: Dictionary; children: ReactNode; withNav?: boolean };

/** Static chrome of the Direction area (no session read here, so it prerenders). */
export function StaffShell({ lang, dict, children, withNav = true }: Props) {
  const t = dict.staff.nav;
  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <div className={`container ${styles.topRow}`}>
          <Link href={withNav ? staffPath(lang) : `/${lang}`} className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny pre-sized logo */}
            <img src="/brand/goodfly-logo.webp" width={72} height={40} alt="GoodFly" />
            <span className={styles.badge}>{dict.staff.title}</span>
          </Link>
          {withNav && (
            <nav aria-label={t.label} className={styles.nav}>
              <Link href={staffPath(lang)}>{t.overview}</Link>
              <Link href={staffPath(lang, "comptes")}>{t.accounts}</Link>
              <Link href={staffPath(lang, "journal")}>{t.journal}</Link>
              <Link href={staffPath(lang, "mon-compte")}>{t.me}</Link>
            </nav>
          )}
          <div className={styles.topActions}>
            <ThemeToggle label={dict.nav.toggleTheme} />
            {withNav ? (
              <form action={signOut}>
                <input type="hidden" name="lang" value={lang} />
                <button className={styles.ghost} type="submit">
                  {t.logout}
                </button>
              </form>
            ) : (
              <Link className={styles.ghost} href={`/${lang}`}>
                {t.site}
              </Link>
            )}
          </div>
        </div>
      </header>
      <main id="main" className={`container ${styles.main}`}>
        {children}
      </main>
    </div>
  );
}
