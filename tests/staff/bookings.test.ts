// Booking request validation, search-bar prefill and access.  node tests/staff/bookings.test.ts
import { can, staffHome, staffNav } from "../../src/lib/staff/access.ts";
import { parseBooking, parseCode, prefillFromSearch, serviceFromSlug, SERVICE_SLUGS, travelDates, isoDate } from "../../src/lib/bookings/validate.ts";

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, info = "") => {
  if (ok) pass++;
  else fail++;
  console.log(ok ? "  ✓" : "  ✘", name, ok ? "" : `— ${info}`);
};
const form = (v: Record<string, string>) => (k: string) => v[k] ?? (k === "consent" ? null : "");
const good = { full_name: "Salma Bennani", phone: "06 12 34 56 78", email: "Salma@Exemple.ma", to_place: "Istanbul", adults: "2", consent: "on" };

console.log("Booking form");
const ok = parseBooking(form(good));
check("a valid request parses (children default to 0)", ok.ok && ok.value.adults === 2 && ok.value.children === 0, JSON.stringify(ok));
check("international numbers are accepted", parseBooking(form({ ...good, phone: "+212 6 12-34-56-78" })).ok);
const bad = parseBooking(form({ full_name: "S", phone: "12", email: "x@", adults: "0", children: "99", message: "x".repeat(1001) }));
check(
  "every invalid field is reported",
  !bad.ok && ["full_name", "phone", "email", "adults", "children", "message", "to_place", "consent"].every((k) => k in bad.errors),
  JSON.stringify(bad),
);
check("letters in the phone are refused", !parseBooking(form({ ...good, phone: "06 12 AB 56 78" })).ok);
check("a programme replaces the destination", parseBooking(form({ ...good, to_place: "", program: "omra-ramadan-2027" })).ok);
check("a malformed programme address is refused", !parseBooking(form({ ...good, program: "../../etc" })).ok);
check("consent is required", !parseBooking(form({ ...good, consent: "" })).ok);
const noEmail = parseBooking(form({ ...good, email: "" }));
check("the e-mail address is required", !noEmail.ok && noEmail.errors.email === "required", JSON.stringify(noEmail));
check("the e-mail is stored in lower case", ok.ok && ok.value.email === "salma@exemple.ma");

console.log("Verification code");
check("6 digits are read, spaces and dashes ignored", parseCode("123456") === "123456" && parseCode(" 123 456 ") === "123456" && parseCode("123-456") === "123456");
check("Arabic-Indic digits are read", parseCode("١٢٣٤٥٦") === "123456" && parseCode("۱۲۳۴۵۶") === "123456");
check("anything else is refused", [null, "", "12345", "1234567", "12345a", "abcdef"].every((v) => parseCode(v) === null));
check("decimal or text traveller counts are refused", !parseBooking(form({ ...good, adults: "1.5" })).ok && !parseBooking(form({ ...good, adults: "deux" })).ok);

console.log("Search bar prefill");
const p = prefillFromSearch({ from: "Casablanca (CMN)", to: "Istanbul", depart: "2027-12-20", retour: "2027-12-27", travellers: "3 adultes · Économie" });
check("search bar values carry over", p.from_place === "Casablanca (CMN)" && p.to_place === "Istanbul" && p.adults === "3" && p.date_from === "2027-12-20" && p.date_to === "2027-12-27", JSON.stringify(p));
check("search bar dates that are not real days are dropped", prefillFromSearch({ depart: "2027-02-30", retour: "demain" }).date_from === "" && prefillFromSearch({ retour: "<x>" }).date_to === "");
check("unknown traveller text falls back to 1", prefillFromSearch({ travellers: "beaucoup" }).adults === "1");
check("bad programme slugs are dropped", prefillFromSearch({ programme: "<script>" }).program === "");
check("overlong values are cut", prefillFromSearch({ to: "x".repeat(500) }).to_place.length === 120);

console.log("Travel dates (calendar)");
const dates = (q: Record<string, string>, lang = "fr") => travelDates((k) => q[k], lang, "2026-11-18");
check("a departure and a return are written for the team", dates({ date_from: "2026-12-20", date_to: "2026-12-27" }).text === "du 20/12/2026 au 27/12/2026", dates({ date_from: "2026-12-20", date_to: "2026-12-27" }).text);
check("one-way and flexible are written too", dates({ date_from: "2026-12-20", dates_flexible: "on" }).text === "départ le 20/12/2026 · dates flexibles");
check("Arabic clients get Arabic wording", dates({ date_from: "2026-12-20", date_to: "2026-12-27" }, "ar").text === "من 20/12/2026 إلى 27/12/2026");
check("no dates is allowed", dates({}).text === "" && !Object.keys(dates({}).errors).length);
check("a past departure is refused", dates({ date_from: "2026-11-01" }).errors.date_from === "past");
check("yesterday is tolerated (time zones)", !dates({ date_from: "2026-11-17" }).errors.date_from);
check("a return before the departure is refused", dates({ date_from: "2026-12-20", date_to: "2026-12-19" }).errors.date_to === "before");
check("a return without a departure is refused", dates({ date_to: "2026-12-27" }).errors.date_to === "needsFrom");
check("typed text or impossible days are refused", dates({ date_from: "20 décembre" }).errors.date_from === "format" && dates({ date_from: "2027-02-30" }).errors.date_from === "format");
check("dates more than three years ahead are refused", dates({ date_from: "2031-01-01" }).errors.date_from === "far");
check("isoDate reads only real yyyy-mm-dd days", isoDate("2028-02-29") === "2028-02-29" && isoDate("2027-02-29") === null && isoDate("2027-13-01") === null);
check("the free-text dates field is ignored (calendar only)", parseBooking(form({ ...good, travel_dates: "<script>" })).ok && (parseBooking(form({ ...good, travel_dates: "<script>" })) as { value: { travel_dates: string } }).value.travel_dates === "");

console.log("Access");
const booker = { role: "agent" as const, permissions: ["bookings.manage" as const] };
const writer = { role: "agent" as const, permissions: ["programs.manage" as const] };
check("bookings need the permission", can(booker, "bookings.manage") && !can(writer, "bookings.manage"));
check("a booking agent lands on Réservations", staffHome(booker) === "reservations");
check("the menu shows Réservations only with the permission", staffNav(booker).some((i) => i.key === "bookings") && !staffNav(writer).some((i) => i.key === "bookings"));
check("the menu shows Avis clients with the same permission", staffNav(booker).some((i) => i.key === "reviews") && !staffNav(writer).some((i) => i.key === "reviews"));

console.log("Services");
check("a known service is kept", parseBooking(form({ ...good, service: "visa" })).ok && (parseBooking(form({ ...good, service: "visa" })) as { value: { service: string } }).value.service === "visa");
check("an unknown service is refused", !parseBooking(form({ ...good, service: "car" })).ok);
check("the search bar keeps a known service only", prefillFromSearch({ service: "stay" }).service === "stay" && prefillFromSearch({ service: "<x>" }).service === "");
check("page addresses map to services and back", serviceFromSlug("vols") === "flight" && serviceFromSlug(SERVICE_SLUGS.visa) === "visa" && serviceFromSlug("admin") === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
