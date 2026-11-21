import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";
import { locales } from "@/i18n/config";

/** Search engines may read every public page; the staff area stays out of their index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Staff area and the private review links sent by e-mail.
      disallow: locales.flatMap((lang) => [`/${lang}/espace`, `/${lang}/avis/`]),
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
