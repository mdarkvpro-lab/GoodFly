import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalView } from "@/components/legal/LegalView";
import { legalContent } from "@/content/legal";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/confidentialite">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const page = legalContent(lang, "privacy");
  return {
    title: `${page.title} · GoodFly`,
    description: page.intro,
    alternates: { languages: { fr: "/fr/confidentialite", ar: "/ar/confidentialite" } },
  };
}

export default async function Page({ params }: PageProps<"/[lang]/confidentialite">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <LegalView lang={lang} dict={await getDictionary(lang)} kind="privacy" />;
}
