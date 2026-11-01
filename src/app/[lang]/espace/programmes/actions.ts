"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { requireDirection, requireStaff, staffPath } from "@/lib/staff/dal";
import { checkImage, parseProgram, type FieldErrors } from "@/lib/programs/validate";

export type ProgramFormState =
  | { errors?: FieldErrors & { image?: string }; error?: "generic" | "taken"; values?: Record<string, string> }
  | undefined;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BUCKET = "program-images";

const langOf = (form: FormData): Locale => {
  const v = String(form.get("lang") ?? "");
  return isLocale(v) ? v : defaultLocale;
};

const TEXT_FIELDS = [
  "slug",
  "status",
  "title_fr",
  "title_ar",
  "summary_fr",
  "summary_ar",
  "description_fr",
  "description_ar",
  "destination",
  "start_date",
  "end_date",
  "duration_days",
  "price_from_mad",
] as const;

/** Echo the typed values back so nothing is lost when the form has an error. */
const echo = (form: FormData) => Object.fromEntries(TEXT_FIELDS.map((k) => [k, String(form.get(k) ?? "").slice(0, 5000)]));

const randomName = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");

export async function saveProgram(_prev: ProgramFormState, form: FormData): Promise<ProgramFormState> {
  const lang = langOf(form);
  const { supabase } = await requireStaff(lang, { permission: "programs.manage" });
  const id = String(form.get("id") ?? "");
  if (id && !UUID.test(id)) return { error: "generic", values: echo(form) };

  const parsed = parseProgram((k) => form.get(k));
  if (!parsed.ok) return { errors: parsed.errors, values: echo(form) };
  const program = parsed.value;

  // Optional new photo: declared type, size and real file signature are checked before upload.
  const file = form.get("image");
  let newImage: string | null = null;
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkImage(file.type, file.size, bytes.subarray(0, 16));
    if (!check.ok) return { errors: { image: check.error }, values: echo(form) };
    newImage = `programs/${program.slug}-${randomName()}.${check.ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(newImage, bytes, { contentType: file.type, upsert: false, cacheControl: "31536000" });
    if (error) return { errors: { image: "upload" }, values: echo(form) };
  }

  let previousImage: string | null = null;
  if (id) {
    const { data: current } = await supabase.from("programs").select("image_path").eq("id", id).maybeSingle();
    previousImage = current?.image_path ?? null;
  }
  const removeImage = form.get("removeImage") === "on";
  const row = { ...program, ...(newImage ? { image_path: newImage } : removeImage ? { image_path: null } : {}) };

  const res = id
    ? await supabase.from("programs").update(row).eq("id", id).select("id")
    : await supabase.from("programs").insert(row).select("id");

  if (res.error || !res.data?.length) {
    if (newImage) await supabase.storage.from(BUCKET).remove([newImage]); // no orphan photo
    return { error: res.error?.code === "23505" ? "taken" : "generic", values: echo(form) };
  }
  if (previousImage && (newImage || removeImage)) await supabase.storage.from(BUCKET).remove([previousImage]);

  updateTag("programs");
  redirect(`${staffPath(lang, "programmes")}?m=programSaved`);
}

/** Deleting a programme is reserved to Direction (also enforced by RLS). */
export async function deleteProgram(form: FormData) {
  const lang = langOf(form);
  const { supabase } = await requireDirection(lang);
  const id = String(form.get("id") ?? "");
  const back = staffPath(lang, "programmes");
  if (!UUID.test(id)) redirect(`${back}?e=generic`);
  const { data, error } = await supabase.from("programs").delete().eq("id", id).select("image_path");
  if (error || !data?.length) redirect(`${back}?e=generic`);
  const image = data[0].image_path as string | null;
  if (image) await supabase.storage.from(BUCKET).remove([image]);
  updateTag("programs");
  redirect(`${back}?m=programDeleted`);
}
