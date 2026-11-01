import type { Locale } from "@/i18n/config";
import type { Program } from "@/lib/programs/data";

/** Text helpers for programme cards and pages. */
export function programText(p: Program, lang: Locale) {
  const ar = lang === "ar";
  return {
    title: (ar && p.title_ar) || p.title_fr,
    summary: (ar && p.summary_ar) || p.summary_fr,
    description: (ar && p.description_ar) || p.description_fr,
  };
}

export function programFacts(p: Program, lang: Locale, t: { days: string; from: string }) {
  const locale = lang === "ar" ? "ar-MA" : "fr-MA";
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const dates =
    p.start_date && p.end_date
      ? day.formatRange(new Date(`${p.start_date}T00:00:00Z`), new Date(`${p.end_date}T00:00:00Z`))
      : p.start_date
        ? day.format(new Date(`${p.start_date}T00:00:00Z`))
        : null;
  const days = p.duration_days ? t.days.replace("{n}", new Intl.NumberFormat(locale).format(p.duration_days)) : null;
  const price =
    p.price_from_mad !== null
      ? t.from.replace("{price}", new Intl.NumberFormat(locale, { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(p.price_from_mad))
      : null;
  return { dates, days, price };
}
