import { homeAirportLabel } from "@/config/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./Hero.module.css";

type Props = { lang: Locale; dict: Dictionary };

export function BookingBar({ lang, dict }: Props) {
  const t = dict.booking;
  return (
    <form id="booking" className={styles.booking} action={`/${lang}/reservation`} method="get" aria-label={t.label}>
      <label className={styles.field}>
        <span>{t.from}</span>
        <input name="from" defaultValue={homeAirportLabel(lang)} autoComplete="off" />
      </label>
      <label className={styles.field}>
        <span>{t.to}</span>
        <input name="to" placeholder={t.toPlaceholder} autoComplete="off" />
      </label>
      <label className={styles.field}>
        <span>{t.dates}</span>
        <input name="dates" placeholder={t.datesPlaceholder} autoComplete="off" />
      </label>
      <label className={styles.field}>
        <span>{t.travellers}</span>
        <input name="travellers" defaultValue={t.travellersDefault} autoComplete="off" />
      </label>
      <button type="submit" className={styles.submit}>
        {t.submit}
      </button>
    </form>
  );
}
