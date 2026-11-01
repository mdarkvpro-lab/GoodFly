/** Text of the Telegram alert for a new booking request (pure, unit-tested in tests/staff). */

export type BookingSummary = {
  reference: string;
  service?: "" | "flight" | "stay" | "visa";
  program_title?: string;
  from_place?: string;
  to_place?: string;
  travel_dates?: string;
  adults: number;
  children: number;
  lang: "fr" | "ar";
};

const SERVICE_LABEL = { flight: "Vol", stay: "Hôtel / séjour", visa: "Visa" } as const;

// One line, no control characters, bounded length: the values come from the visitor.
const clean = (s: string | undefined, max = 80) => (s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * French text for the agency group. The client's name, phone and e-mail are never sent
 * to Telegram (law 09-08): staff open the request in the Espace GoodFly to call back.
 */
export function bookingMessage(b: BookingSummary, staffUrl?: string): string {
  const trip = clean(b.program_title) || [clean(b.from_place), clean(b.to_place)].filter(Boolean).join(" → ") || "—";
  const people = `${b.adults} adulte(s)${b.children ? `, ${b.children} enfant(s)` : ""}`;
  const lines = [
    "Nouvelle demande de réservation",
    `Réf. ${b.reference}`,
    ...(b.service ? [`Service : ${SERVICE_LABEL[b.service]}`] : []),
    `${b.program_title ? "Programme" : "Voyage"} : ${trip}`,
    ...(clean(b.travel_dates) ? [`Dates : ${clean(b.travel_dates)}`] : []),
    `Voyageurs : ${people}`,
    ...(b.lang === "ar" ? ["Client arabophone"] : []),
  ];
  if (staffUrl) lines.push("", `Ouvrir : ${staffUrl}`);
  return lines.join("\n");
}

/** Short phone notification (Web Push): same rules, no client name, phone or e-mail. */
export function bookingPush(b: BookingSummary) {
  const trip = clean(b.program_title, 60) || clean(b.to_place, 60) || "—";
  const people = `${b.adults} adulte(s)${b.children ? `, ${b.children} enfant(s)` : ""}`;
  return {
    title: "Nouvelle demande de réservation",
    body: [b.reference, b.service ? SERVICE_LABEL[b.service] : "", trip, clean(b.travel_dates, 40), people].filter(Boolean).join(" · "),
    url: "/fr/espace/reservations?statut=new",
    tag: `booking-${b.reference}`,
  };
}
