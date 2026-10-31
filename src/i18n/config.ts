export const locales = ["fr", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

export const localeDir: Record<Locale, "ltr" | "rtl"> = {
  fr: "ltr",
  ar: "rtl",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
