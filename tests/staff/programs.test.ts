// Programme validation, photo checks and staff access rules.  node tests/staff/programs.test.ts
import { can, staffHome, staffNav } from "../../src/lib/staff/access.ts";
import { checkImage, parseProgram, slugify } from "../../src/lib/programs/validate.ts";

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, info = "") => {
  if (ok) pass++;
  else fail++;
  console.log(ok ? "  ✓" : "  ✘", name, ok ? "" : `— ${info}`);
};
const form = (v: Record<string, string>) => (k: string) => v[k] ?? "";

console.log("Programmes");
check("slug from a French title", slugify("Omra — Ramadan 2027 !") === "omra-ramadan-2027", slugify("Omra — Ramadan 2027 !"));
check("accents are removed", slugify("Séjour à Fès") === "sejour-a-fes", slugify("Séjour à Fès"));
const ok = parseProgram(form({ title_fr: "Omra de printemps", status: "published", price_from_mad: "18 500", duration_days: "15", start_date: "2027-03-01", end_date: "2027-03-15" }));
check("a valid programme parses (slug made from the title, spaces in prices accepted)", ok.ok && ok.value.slug === "omra-de-printemps" && ok.value.price_from_mad === 18500, JSON.stringify(ok));
const bad = parseProgram(form({ title_fr: "ab", slug: "Bad Slug!", status: "live", start_date: "2027-03-10", end_date: "2027-03-01", duration_days: "0", price_from_mad: "-5" }));
check(
  "invalid fields are all reported",
  !bad.ok && ["title_fr", "slug", "status", "end_date", "duration_days", "price_from_mad"].every((k) => k in bad.errors),
  JSON.stringify(bad),
);
check("impossible dates are refused", !parseProgram(form({ title_fr: "Titre ok", start_date: "2027-02-30" })).ok);
check("overlong descriptions are refused", !parseProgram(form({ title_fr: "Titre ok", description_fr: "x".repeat(5001) })).ok);

console.log("Photos");
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const html = new TextEncoder().encode("<html><script>");
check("real JPEG/PNG/WebP accepted", checkImage("image/jpeg", 1000, jpeg).ok && checkImage("image/png", 1000, png).ok && checkImage("image/webp", 1000, webp).ok);
check("HTML renamed as .jpg is refused (file signature)", !checkImage("image/jpeg", 1000, html).ok);
check("SVG is refused", !checkImage("image/svg+xml", 1000, html).ok);
check("PNG declared as JPEG is refused", !checkImage("image/jpeg", 1000, png).ok);
check("photos over 5 MB are refused", !checkImage("image/jpeg", 5 * 1024 * 1024 + 1, jpeg).ok);

console.log("Staff access");
const boss = { role: "direction" as const, permissions: [] };
const writer = { role: "agent" as const, permissions: ["programs.manage" as const] };
const nobody = { role: "agent" as const, permissions: [] };
check("Direction can do everything", can(boss, "programs.manage") && can(boss, "bookings.manage") && can(boss, "reports.view"));
check("an employee only has granted permissions", can(writer, "programs.manage") && !can(writer, "bookings.manage") && !can(writer, "reports.view"));
check("home page follows permissions", staffHome(boss) === "" && staffHome(writer) === "programmes" && staffHome(nobody) === "mon-compte");
const nav = (u: Parameters<typeof staffNav>[0]) => staffNav(u).map((i) => i.key).join(",");
check("employees never see Employés or Journal", !/employees|journal/.test(nav(writer)), nav(writer));
check("Direction sees the full menu", nav(boss) === "overview,bookings,programs,employees,notifications,journal,me", nav(boss));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
