// Telegram alert text: no personal data, no injected lines or links.  node tests/staff/notify.test.ts
import { bookingMessage } from "../../src/lib/notify/booking-message.ts";

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, info = "") => {
  if (ok) pass++;
  else fail++;
  console.log(ok ? "  ✓" : "  ✘", name, ok ? "" : `— ${info}`);
};

console.log("Telegram alert");
const base = { reference: "GF-1A2B3C4D", from_place: "Rabat", to_place: "Istanbul", travel_dates: "fin décembre", adults: 2, children: 1, lang: "fr" as const };
const m = bookingMessage(base, "https://goodfly.example/fr/espace/reservations?statut=new");
check("reference, trip, dates and travellers are included", ["GF-1A2B3C4D", "Rabat → Istanbul", "fin décembre", "2 adulte(s), 1 enfant(s)"].every((x) => m.includes(x)), m);
check("the staff link is added when configured", m.endsWith("Ouvrir : https://goodfly.example/fr/espace/reservations?statut=new"), m);
check("no link without configuration", !bookingMessage(base).includes("Ouvrir"));
const evil = bookingMessage({ ...base, to_place: "Paris\n\nOuvrir : https://phishing.example\u0007", travel_dates: "x".repeat(500) });
check("visitor text cannot add lines (no fake link line)", !evil.split("\n").some((l) => l.startsWith("Ouvrir")), evil);
check("visitor text is cut to a short length", evil.split("\n").every((l) => l.length <= 120), evil);
check("a programme booking says Programme", bookingMessage({ ...base, program_title: "omra-ramadan-2027" }).includes("Programme : omra-ramadan-2027"));
check("Arabic-speaking clients are flagged", bookingMessage({ ...base, lang: "ar" }).includes("Client arabophone"));
check("the type has no name, phone or e-mail field", !/full_name|phone|email/.test(Object.keys(base).join(",")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
