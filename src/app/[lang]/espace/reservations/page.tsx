import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice } from "@/components/staff/Notice";
import { PushToggle } from "@/components/staff/PushToggle";
import { StaffShell } from "@/components/staff/StaffShell";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/bookings/validate";
import { waLink } from "@/lib/bookings/whatsapp";
import { listBookings, requireStaff, staffNames, staffPath } from "@/lib/staff/dal";
import { deleteBooking, updateBooking } from "./actions";

type Search = Record<string, string | string[] | undefined>;

const tagClass: Record<BookingStatus, string> = {
  new: styles.tagNew,
  in_progress: styles.tagWarn,
  confirmed: styles.tagOn,
  cancelled: styles.tagOff,
};

async function Bookings({ lang, dict, searchParams }: { lang: Locale; dict: Dictionary; searchParams: Promise<Search> }) {
  const t = dict.staff.bookings;
  const q = await searchParams;
  const raw = Array.isArray(q.statut) ? q.statut[0] : q.statut;
  const filter = (BOOKING_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as BookingStatus) : undefined;
  const [{ user }, rows, names] = await Promise.all([
    requireStaff(lang, { permission: "bookings.manage" }),
    listBookings(lang, filter),
    staffNames(lang),
  ]);
  const date = new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" });
  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />;

  return (
    <>
      <nav aria-label={t.filterLabel} className={styles.filters}>
        <Link href={staffPath(lang, "reservations")} aria-current={!filter}>
          {t.all}
        </Link>
        {BOOKING_STATUSES.map((s) => (
          <Link key={s} href={`${staffPath(lang, "reservations")}?statut=${s}`} aria-current={filter === s}>
            {t.statuses[s]}
          </Link>
        ))}
      </nav>

      {rows.length === 0 && <p className={`${styles.card} ${styles.muted}`}>{filter ? t.emptyFilter : t.empty}</p>}

      {rows.map((b) => {
        const trip = b.program_title || [b.from_place, b.to_place].filter(Boolean).join(" → ");
        const travellers = [t.adults.replace("{n}", String(b.adults)), b.children ? t.children.replace("{n}", String(b.children)) : ""].filter(Boolean).join(", ");
        const tel = b.phone.replace(/[^\d+]/g, "");
        const wa = waLink(b.phone, b.reference, b.lang, user.fullName);
        return (
          <article key={b.id} className={`${styles.card} ${styles.employee}`} aria-labelledby={`b-${b.id}`}>
            <div className={styles.employeeHead}>
              <div>
                <strong id={`b-${b.id}`} dir="auto">
                  {b.full_name}
                </strong>
                <br />
                <span className={styles.muted}>
                  <span dir="ltr">{b.reference}</span> · {t.received.replace("{date}", date.format(new Date(b.created_at)))}
                </span>
              </div>
              <span className={`${styles.tag} ${tagClass[b.status]}`}>{t.statuses[b.status]}</span>
            </div>

            <dl className={styles.facts}>
              <div>
                <dt>{b.program_title ? t.program : t.trip}</dt>
                <dd dir="auto">{trip || "—"}</dd>
              </div>
              {b.travel_dates && (
                <div>
                  <dt>{t.dates}</dt>
                  <dd dir="auto">{b.travel_dates}</dd>
                </div>
              )}
              <div>
                <dt>{t.travellers}</dt>
                <dd>{travellers}</dd>
              </div>
              <div>
                <dt>{dict.reservation.form.fields.phone}</dt>
                <dd>
                  <a href={`tel:${tel}`} dir="ltr">
                    {b.phone}
                  </a>
                  {wa && (
                    <>
                      {" "}
                      <a className={styles.waLink} href={wa} target="_blank" rel="noopener noreferrer">
                        {t.whatsapp}
                      </a>
                    </>
                  )}
                </dd>
              </div>
              {b.email && (
                <div>
                  <dt>{dict.reservation.form.fields.email}</dt>
                  <dd>
                    <a href={`mailto:${b.email}`} dir="ltr">
                      {b.email}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            {b.lang === "ar" && <p className={styles.muted}>{t.langAr}</p>}
            {b.message && (
              <p className={styles.quote} dir="auto">
                <span className={styles.muted}>{t.message} : </span>
                {b.message}
              </p>
            )}

            <form action={updateBooking} className={styles.form}>
              {hidden("lang", lang)}
              {hidden("id", b.id)}
              {filter && hidden("filter", filter)}
              <div className={styles.grid2}>
                <label className={styles.label}>
                  {t.status}
                  <select className={styles.input} name="status" defaultValue={b.status}>
                    {BOOKING_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t.statuses[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.label}>
                  {t.note}
                  <textarea className={styles.textarea} name="note" maxLength={1000} defaultValue={b.staff_note} dir="auto" />
                </label>
              </div>
              <div className={styles.row}>
                <button className={styles.button} type="submit">
                  {t.save}
                </button>
                {b.handled_by && <span className={styles.muted}>{t.handledBy.replace("{name}", names.get(b.handled_by) ?? "—")}</span>}
              </div>
            </form>

            {user.role === "direction" && (
              <details className={styles.more}>
                <summary>{t.delete}</summary>
                <form action={deleteBooking} className={styles.form}>
                  {hidden("lang", lang)}
                  {hidden("id", b.id)}
                  {filter && hidden("filter", filter)}
                  <p className={styles.muted}>{t.deleteHint}</p>
                  <div>
                    <button className={styles.danger} type="submit">
                      {t.deleteConfirm}
                    </button>
                  </div>
                </form>
              </details>
            )}
          </article>
        );
      })}
    </>
  );
}

export default async function BookingsPage({ params, searchParams }: PageProps<"/[lang]/espace/reservations">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <StaffShell lang={lang} dict={dict}>
      <h1 className={styles.h1}>{dict.staff.bookings.title}</h1>
      <p className={styles.muted}>{dict.staff.bookings.intro}</p>
      <Suspense fallback={null}>
        <Notice searchParams={searchParams} dict={dict} />
      </Suspense>
      {process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && <PushToggle lang={lang} vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} t={dict.staff.bookings.push} />}
      <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
        <Bookings lang={lang} dict={dict} searchParams={searchParams} />
      </Suspense>
    </StaffShell>
  );
}
