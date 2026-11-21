import type { Locale } from "@/i18n/config";

/**
 * Default departure airport for the booking bar.
 * Change it with NEXT_PUBLIC_HOME_AIRPORT_CODE (only airports listed here are accepted).
 */
const airports = {
  RBA: { fr: "Rabat–Salé", ar: "الرباط–سلا" },
  CMN: { fr: "Casablanca Mohammed V", ar: "الدار البيضاء محمد الخامس" },
} as const;

type AirportCode = keyof typeof airports;

/** Airport reference points (latitude, longitude in degrees) used for the route map and distances. */
export const AIRPORT_COORDS: Record<string, { lat: number; lon: number }> = {
  RBA: { lat: 34.0515, lon: -6.7515 },
  CMN: { lat: 33.3675, lon: -7.5899 },
  MED: { lat: 24.5534, lon: 39.7051 },
  IST: { lat: 41.2753, lon: 28.7519 },
  CDG: { lat: 49.0097, lon: 2.5479 },
  DXB: { lat: 25.2532, lon: 55.3657 },
};

function resolveHomeAirport(): AirportCode {
  const code = process.env.NEXT_PUBLIC_HOME_AIRPORT_CODE;
  return code && code in airports ? (code as AirportCode) : "RBA";
}

export const homeAirport = resolveHomeAirport();

export function homeAirportName(locale: Locale): string {
  return airports[homeAirport][locale];
}

export function homeAirportLabel(locale: Locale): string {
  return `${homeAirportName(locale)} (${homeAirport})`;
}

/** Great-circle ("as the crow flies") distance in km between two airports, rounded to 100 km. */
export function distanceKm(from: string, to: string): number | null {
  const a = AIRPORT_COORDS[from];
  const b = AIRPORT_COORDS[to];
  if (!a || !b) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  const km = 2 * 6371 * Math.asin(Math.sqrt(h));
  return Math.round(km / 100) * 100;
}

/**
 * Example destinations shown on the homepage.
 * `confirmed: false` keeps the "example — to be confirmed" badge visible
 * until GoodFly verifies each offer.
 */
export const destinations = [
  { id: "makkah-madinah", code: "MED", confirmed: false, image: "/images/dest-makkah-madinah.jpg" },
  { id: "istanbul", code: "IST", confirmed: false, image: "/images/dest-istanbul.jpg" },
  { id: "paris", code: "CDG", confirmed: false, image: "/images/dest-paris.jpg" },
  { id: "dubai", code: "DXB", confirmed: false, image: "/images/dest-dubai.jpg" },
] as const;

export type DestinationId = (typeof destinations)[number]["id"];

/** Agency contact details (shown in the footer and used for the WhatsApp button). */
export const AGENCY = {
  address: {
    fr: "Route de Kénitra (face aux Arcades), Immeuble 4, Appartement 1, Salé",
    ar: "طريق القنيطرة (أمام الأقواس القنيطرة)، عمارة 4، شقة 1، سلا",
  },
  phones: [
    { display: "05 30 16 43 43", tel: "+212530164343" },
    { display: "06 58 89 99 07", tel: "+212658899907" },
  ],
  whatsapp: "212658899907",
  email: "goodfly64@gmail.com",
  /** The agency's own social pages. */
  social: {
    instagram: "https://www.instagram.com/goodfly64/",
    facebook: "https://www.facebook.com/goodfly.net",
  },
} as const;

/** Official WhatsApp link to the agency with a first message in the visitor's language. */
export function agencyWhatsApp(lang: Locale): string {
  const text = lang === "ar" ? "السلام عليكم، أريد معلومات عن رحلة مع GoodFly." : "Bonjour GoodFly, je souhaite des informations sur un voyage.";
  return `https://wa.me/${AGENCY.whatsapp}?text=${encodeURIComponent(text)}`;
}

/**
 * Public address of the site (https://…, no trailing slash), from SITE_URL.
 * Used for the sitemap, robots.txt and absolute links shared on social networks.
 */
export function siteUrl(): string {
  const url = process.env.SITE_URL;
  return url && /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(url) ? url : "https://goodfly.ma";
}

/** schema.org description of the agency, read by Google for its business panel and search results. */
export function agencyJsonLd(lang: Locale) {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: "GoodFly",
    url: `${base}/${lang}`,
    logo: `${base}/brand/goodfly-logo.webp`,
    image: `${base}/brand/goodfly-logo.webp`,
    email: AGENCY.email,
    telephone: AGENCY.phones.map((p) => p.tel),
    address: {
      "@type": "PostalAddress",
      streetAddress: AGENCY.address[lang],
      addressLocality: lang === "ar" ? "سلا" : "Salé",
      addressCountry: "MA",
    },
    areaServed: "MA",
    availableLanguage: ["fr", "ar"],
    sameAs: Object.values(AGENCY.social),
  };
}
