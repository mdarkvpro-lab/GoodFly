/** Validation for programme forms and uploaded photos (pure, unit-tested in tests/staff). */

export const PROGRAM_STATUSES = ["draft", "published", "archived"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export type ProgramInput = {
  slug: string;
  status: ProgramStatus;
  title_fr: string;
  title_ar: string;
  summary_fr: string;
  summary_ar: string;
  description_fr: string;
  description_ar: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  price_from_mad: number | null;
};

export type FieldErrors = Partial<Record<keyof ProgramInput, string>>;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "Omra — Ramadan 2027 !" → "omra-ramadan-2027" */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

const text = (v: unknown, max: number) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max + 1);

function int(v: unknown): number | null | "invalid" {
  const s = String(v ?? "").replace(/\s/g, "");
  if (!s) return null;
  if (!/^\d+$/.test(s)) return "invalid";
  return Number(s);
}

function date(v: unknown): string | null | "invalid" {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (!DATE.test(s)) return "invalid";
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? "invalid" : s;
}

export function parseProgram(get: (name: string) => unknown): { ok: true; value: ProgramInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const title_fr = text(get("title_fr"), 120);
  const title_ar = text(get("title_ar"), 120);
  const slugRaw = text(get("slug"), 80);
  const slug = slugRaw ? slugRaw.toLowerCase() : slugify(title_fr);
  const statusRaw = String(get("status") ?? "draft");
  const status = (PROGRAM_STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as ProgramStatus) : null;

  if (title_fr.length < 3 || title_fr.length > 120) errors.title_fr = "length";
  if (title_ar.length > 120) errors.title_ar = "length";
  if (!SLUG.test(slug) || slug.length > 80) errors.slug = "format";
  if (!status) errors.status = "invalid";

  const fields = {
    summary_fr: text(get("summary_fr"), 300),
    summary_ar: text(get("summary_ar"), 300),
    description_fr: text(get("description_fr"), 5000),
    description_ar: text(get("description_ar"), 5000),
    destination: text(get("destination"), 80),
  };
  if (fields.summary_fr.length > 300) errors.summary_fr = "length";
  if (fields.summary_ar.length > 300) errors.summary_ar = "length";
  if (fields.description_fr.length > 5000) errors.description_fr = "length";
  if (fields.description_ar.length > 5000) errors.description_ar = "length";
  if (fields.destination.length > 80) errors.destination = "length";

  const start = date(get("start_date"));
  const end = date(get("end_date"));
  if (start === "invalid") errors.start_date = "invalid";
  if (end === "invalid") errors.end_date = "invalid";
  if (typeof start === "string" && typeof end === "string" && end < start) errors.end_date = "before";

  const duration = int(get("duration_days"));
  if (duration === "invalid" || (typeof duration === "number" && (duration < 1 || duration > 90))) errors.duration_days = "range";
  const price = int(get("price_from_mad"));
  if (price === "invalid" || (typeof price === "number" && price > 10_000_000)) errors.price_from_mad = "range";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      slug,
      status: status!,
      title_fr,
      title_ar,
      ...fields,
      start_date: start as string | null,
      end_date: end as string | null,
      duration_days: duration as number | null,
      price_from_mad: price as number | null,
    },
  };
}

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/** Checks the declared type, the size, and the file signature (magic bytes) of an uploaded photo. */
export function checkImage(type: string, size: number, head: Uint8Array): { ok: true; ext: string } | { ok: false; error: "type" | "size" } {
  if (size > IMAGE_MAX_BYTES) return { ok: false, error: "size" };
  const ext = IMAGE_TYPES[type as keyof typeof IMAGE_TYPES];
  if (!ext) return { ok: false, error: "type" };
  const b = head;
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const webp =
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  const matches = (ext === "jpg" && jpeg) || (ext === "png" && png) || (ext === "webp" && webp);
  return matches ? { ok: true, ext } : { ok: false, error: "type" };
}
