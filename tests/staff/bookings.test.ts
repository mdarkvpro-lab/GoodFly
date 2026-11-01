// Booking request validation, search-bar prefill and access.  node tests/staff/bookings.test.ts
import { can, staffHome, staffNav } from "../../src/lib/staff/access.ts";
import { parseBooking, prefillFromSearch } from "../../src/lib/bookings/validate.ts";

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, info = "") => {
  if (ok) pass++;
  else fail++;
  console.log(ok ? "  ✓" : "  ✘", name, ok ? "" : `— ${info}`);
};
const form = (v: Record<string, string>) => (k: string) => v[k] ?? (k === "consent" ? null : "");
const good = { full_name: "Salma Bennani", phone: "06 12 34 56 78", to_place: "Istanbul", adults: "2", consent: "on" };

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
check("decimal or text traveller counts are refused", !parseBooking(form({ ...good, adults: "1.5" })).ok && !parseBooking(form({ ...good, adults: "deux" })).ok);

console.log("Search bar prefill");
const p = prefillFromSearch({ from: "Casablanca (CMN)", to: "Istanbul", dates: "20-27 déc.", travellers: "3 adultes · Économie" });
check("search bar values carry over", p.from_place === "Casablanca (CMN)" && p.to_place === "Istanbul" && p.adults === "3", JSON.stringify(p));
check("unknown traveller text falls back to 1", prefillFromSearch({ travellers: "beaucoup" }).adults === "1");
check("bad programme slugs are dropped", prefillFromSearch({ programme: "<script>" }).program === "");
check("overlong values are cut", prefillFromSearch({ to: "x".repeat(500) }).to_place.length === 120);

console.log("Access");
const booker = { role: "agent" as const, permissions: ["bookings.manage" as const] };
const writer = { role: "agent" as const, permissions: ["programs.manage" as const] };
check("bookings need the permission", can(booker, "bookings.manage") && !can(writer, "bookings.manage"));
check("a booking agent lands on Réservations", staffHome(booker) === "reservations");
check("the menu shows Réservations only with the permission", staffNav(booker).some((i) => i.key === "bookings") && !staffNav(writer).some((i) => i.key === "bookings"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
