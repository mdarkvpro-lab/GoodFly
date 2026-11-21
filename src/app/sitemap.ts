import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";
import { locales } from "@/i18n/config";
import { SERVICE_SLUGS } from "@/lib/bookings/validate";
import { getPublishedPrograms } from "@/lib/programs/data";

/**
 * Every public page in French and Arabic, each pointing to its other language.
 * Programmes published by the team appear here on their own (same cache as the programme pages).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entry = (path: string, extra: Partial<MetadataRoute.Sitemap[number]> = {}): MetadataRoute.Sitemap =>
    locales.map((lang) => ({
      url: `${base}/${lang}${path}`,
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${base}/${l}${path}`])) },
      ...extra,
    }));

  const programs = await getPublishedPrograms();

  return [
    ...entry("", { changeFrequency: "weekly", priority: 1 }),
    ...entry("/programmes", { changeFrequency: "daily", priority: 0.9 }),
    ...Object.values(SERVICE_SLUGS).flatMap((slug) => entry(`/services/${slug}`, { changeFrequency: "monthly", priority: 0.8 })),
    ...entry("/reservation", { changeFrequency: "yearly", priority: 0.6 }),
    ...programs.flatMap((p) =>
      entry(`/programmes/${p.slug}`, {
        changeFrequency: "weekly",
        priority: 0.8,
        ...(p.published_at ? { lastModified: new Date(p.published_at) } : {}),
      }),
    ),
    ...entry("/mentions-legales", { changeFrequency: "yearly", priority: 0.2 }),
    ...entry("/confidentialite", { changeFrequency: "yearly", priority: 0.2 }),
  ];
}
