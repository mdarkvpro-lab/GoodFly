import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";
import { locales } from "@/i18n/config";

/** Search engines may read every public page; the staff area stays out of their index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: locales.map((lang) => `/${lang}/espace`),
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
