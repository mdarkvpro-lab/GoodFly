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

function resolveHomeAirport(): AirportCode {
  const code = process.env.NEXT_PUBLIC_HOME_AIRPORT_CODE;
  return code && code in airports ? (code as AirportCode) : "RBA";
}

export const homeAirport = resolveHomeAirport();

export function homeAirportLabel(locale: Locale): string {
  return `${airports[homeAirport][locale]} (${homeAirport})`;
}

/**
 * Example destinations shown on the homepage.
 * `confirmed: false` keeps the "example — to be confirmed" badge visible
 * until GoodFly verifies each offer.
 */
export const destinations = [
  { id: "makkah-madinah", code: "MED", confirmed: false },
  { id: "istanbul", code: "IST", confirmed: false },
  { id: "paris", code: "CDG", confirmed: false },
  { id: "dubai", code: "DXB", confirmed: false },
] as const;

export type DestinationId = (typeof destinations)[number]["id"];
