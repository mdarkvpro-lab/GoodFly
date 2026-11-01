/** Validation for booking requests (pure, unit-tested in tests/staff). The database checks the same rules. */

export const BOOKING_STATUSES = ["new", "in_progress", "confirmed", "cancelled"] as const;

/** Services a client can ask for (empty = general request or programme). */
export const SERVICES = ["flight", "stay", "visa"] as const;
export type Service = (typeof SERVICES)[number];
/** Public page address of each service (same in French and Arabic). */
export const SERVICE_SLUGS: Record<Service, string> = { flight: "vols", stay: "sejours", visa: "visas" };
export const serviceFromSlug = (slug: string): Service | null =>
  (Object.entries(SERVICE_SLUGS).find(([, v]) => v === slug)?.[0] as Service | undefined) ?? null;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type BookingInput = {
  full_name: string;
  phone: string;
  email: string;
  from_place: string;
  to_place: string;
  travel_dates: string;
  adults: number;
  children: number;
  message: string;
  program: string;
  service: Service | "";
};

export type BookingErrors = Partial<Record<keyof BookingInput | "consent", string>>;

const PHONE = /^\+?[0-9 ().-]{8,25}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const text = (v: unknown, max: number) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max + 1);

const int = (v: unknown, fallback: number) => {
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  return /^\d{1,3}$/.test(s) ? Number(s) : NaN;
};

/** The 6-digit code typed by the client (spaces and dashes tolerated), or null. */
export const parseCode = (v: unknown) => {
  // Arabic keyboards may type ٠١٢… or ۰۱۲…: read them as 0-9.
  const s = String(v ?? "")
    .replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) & 0xf))
    .replace(/[\s-]/g, "");
  return /^\d{6}$/.test(s) ? s : null;
};

export function parseBooking(get: (k: string) => unknown): { ok: true; value: BookingInput } | { ok: false; errors: BookingErrors } {
  const errors: BookingErrors = {};
  const value: BookingInput = {
    full_name: text(get("full_name"), 120),
    phone: text(get("phone"), 25),
    email: text(get("email"), 254).toLowerCase(),
    from_place: text(get("from_place"), 120),
    to_place: text(get("to_place"), 120),
    travel_dates: text(get("travel_dates"), 120),
    adults: int(get("adults"), 1),
    children: int(get("children"), 0),
    message: text(get("message"), 1000),
    program: text(get("program"), 80),
    service: "",
  };
  const service = text(get("service"), 10);
  if (service && !(SERVICES as readonly string[]).includes(service)) errors.service = "format";
  else value.service = service as Service | "";

  if (value.full_name.length < 2) errors.full_name = "required";
  else if (value.full_name.length > 120) errors.full_name = "long";
  const digits = value.phone.replace(/\D/g, "");
  if (!value.phone) errors.phone = "required";
  else if (!PHONE.test(value.phone) || digits.length < 8 || digits.length > 15) errors.phone = "format";
  // Required: the address is proven with a 6-digit code before the request is saved.
  if (!value.email) errors.email = "required";
  else if (value.email.length > 254 || !EMAIL.test(value.email)) errors.email = "format";
  if (value.program && !SLUG.test(value.program)) errors.program = "format";
  if (!value.program && !value.to_place) errors.to_place = "required";
  for (const k of ["from_place", "to_place", "travel_dates"] as const) if (value[k].length > 120) errors[k] = "long";
  if (value.message.length > 1000) errors.message = "long";
  if (!Number.isInteger(value.adults) || value.adults < 1 || value.adults > 20) errors.adults = "range";
  if (!Number.isInteger(value.children) || value.children < 0 || value.children > 20) errors.children = "range";
  if (get("consent") !== "on") errors.consent = "required";

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/** Values carried over from the homepage search bar (?from=&to=&dates=&travellers=). */
export function prefillFromSearch(q: Record<string, string | string[] | undefined>) {
  const one = (k: string) => {
    const v = q[k];
    return ((Array.isArray(v) ? v[0] : v) ?? "").trim().slice(0, 120);
  };
  const travellers = /^\s*(\d{1,2})/.exec(one("travellers"));
  const adults = travellers ? Math.min(Math.max(Number(travellers[1]), 1), 20) : 1;
  const program = one("programme");
  const service = one("service");
  return {
    service: (SERVICES as readonly string[]).includes(service) ? service : "",
    from_place: one("from"),
    to_place: one("to"),
    travel_dates: one("dates"),
    adults: String(adults),
    program: SLUG.test(program) ? program.slice(0, 80) : "",
  };
}
