import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";

/**
 * Published programmes for the public pages. Read with the public key (RLS: published only),
 * cached and refreshed instantly when staff save a programme (updateTag("programs")).
 */

export type Program = {
  id: string;
  slug: string;
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
  image_path: string | null;
  published_at: string | null;
};

const COLUMNS =
  "id, slug, title_fr, title_ar, summary_fr, summary_ar, description_fr, description_ar, destination, start_date, end_date, duration_days, price_from_mad, image_path, published_at";

export function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getPublishedPrograms(): Promise<Program[]> {
  "use cache";
  cacheTag("programs");
  cacheLife("minutes");
  const db = publicClient();
  if (!db) return [];
  const { data, error } = await db.from("programs").select(COLUMNS).eq("status", "published").order("published_at", { ascending: false }).limit(60);
  if (error) {
    console.error("[programs] list failed:", error.message);
    return [];
  }
  return (data ?? []) as Program[];
}

export async function getPublishedProgram(slug: string): Promise<Program | null> {
  "use cache";
  cacheTag("programs");
  cacheLife("minutes");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
  const db = publicClient();
  if (!db) return null;
  const { data } = await db.from("programs").select(COLUMNS).eq("status", "published").eq("slug", slug).maybeSingle();
  return (data as Program | null) ?? null;
}

export function programImageUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/program-images/${path}`;
}
