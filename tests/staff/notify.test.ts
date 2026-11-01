// Telegram alert text: no personal data, no injected lines or links.  node tests/staff/notify.test.ts
import { bookingMessage, bookingPush } from "../../src/lib/notify/booking-message.ts";
import { waLink, waNumber } from "../../src/lib/bookings/whatsapp.ts";

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

console.log("Phone notification (Web Push)");
const push = bookingPush({ ...base, to_place: "Istanbul\nhttps://evil.example" });
check("short text with reference, trip and travellers", push.body.startsWith("GF-1A2B3C4D · Istanbul") && push.body.includes("2 adulte(s)"), push.body);
check("the click opens the staff page on this site (relative link only)", push.url === "/fr/espace/reservations?statut=new");
check("no line breaks from visitor text", !push.body.includes("\n"), push.body);

console.log("WhatsApp button");
const cases: [string, string | null][] = [
  ["06 12 34 56 78", "212612345678"],
  ["0712345678", "212712345678"],
  ["+212 6 12 34 56 78", "212612345678"],
  ["00212612345678", "212612345678"],
  ["+212 0612345678", "212612345678"],
  ["+33 6 12 34 56 78", "33612345678"],
  ["12", null],
];
for (const [input, want] of cases) check(`${input} → ${want}`, waNumber(input) === want, String(waNumber(input)));
const link = waLink("0612345678", "GF-1A2B3C4D", "fr", "Salma");
check("link is an official wa.me link with a prefilled message", !!link && link.startsWith("https://wa.me/212612345678?text=") && decodeURIComponent(link.split("text=")[1]).includes("GF-1A2B3C4D"), String(link));
check("Arabic clients get an Arabic message", decodeURIComponent(waLink("0612345678", "GF-1", "ar", "")!.split("text=")[1]).startsWith("السلام عليكم"));

console.log("Service in alerts");
check("the service is named in the group message", bookingMessage({ ...base, service: "visa" }).includes("Service : Visa"));
check("the service is in the phone notification", bookingPush({ ...base, service: "flight" }).body.includes("Vol"));
check("alert titles carry no emoji", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(bookingPush(base).title + bookingMessage(base)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
