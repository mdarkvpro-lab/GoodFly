import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { signOut } from "@/app/[lang]/espace/actions";
import { ThemeToggle } from "@/components/header/ThemeToggle";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { can, staffNav } from "@/lib/staff/access";
import { BookingAlerts } from "./BookingAlerts";
import { countNewBookings, requireStaff, staffPath } from "@/lib/staff/dal";
import styles from "./staff.module.css";

type Props = { lang: Locale; dict: Dictionary; children: ReactNode; withNav?: boolean };

/** Links the signed-in account may use (session read, so rendered inside Suspense). */
async function StaffNav({ lang, t, bookingsLive }: { lang: Locale; t: Dictionary["staff"]["nav"]; bookingsLive: Dictionary["staff"]["bookings"]["live"] }) {
  const [{ user }, waiting] = await Promise.all([requireStaff(lang, { allowPasswordChange: true }), countNewBookings(lang)]);
  return (
    <>
      {staffNav(user).map((item) => (
        <Link key={item.key} href={staffPath(lang, item.page)}>
          {t[item.key]}
          {item.key === "bookings" && waiting > 0 && (
            <span className={styles.navCount} aria-label={`(${waiting})`}>
              {waiting}
            </span>
          )}
        </Link>
      ))}
      {can(user, "bookings.manage") && <BookingAlerts href={staffPath(lang, "reservations")} t={bookingsLive} />}
    </>
  );
}

/** Static chrome of the staff area; only the nav links depend on the session. */
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
              <Suspense fallback={null}>
                <StaffNav lang={lang} t={t} bookingsLive={dict.staff.bookings.live} />
              </Suspense>
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
