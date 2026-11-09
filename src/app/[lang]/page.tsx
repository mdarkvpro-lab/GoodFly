import { notFound } from "next/navigation";
import { Header } from "@/components/header/Header";
import { Hero } from "@/components/hero/Hero";
import { Destinations } from "@/components/sections/Destinations";
import { Comfort, Featured, FinalCta, Footer, Services, Why } from "@/components/sections/Sections";
import { destinations, distanceKm, homeAirport, homeAirportName } from "@/config/site";
import { isLocale, localeDir } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const d = dict.destinations;

  return (
    <>
      <a href="#main" className="skip-link">
        {dict.nav.skipToContent}
      </a>
      <Header lang={lang} dict={dict} />
      <main id="main">
        <Hero lang={lang} dict={dict} />
        {/* The aircraft departs at the end of the hero and the route arc picks up the journey. */}
        <Destinations
          eyebrow={d.eyebrow}
          title={d.title}
          unconfirmed={d.unconfirmed}
          listLabel={d.listLabel}
          routeLabel={d.routeLabel}
          dir={localeDir[lang]}
          lang={lang}
          origin={{ code: homeAirport, name: homeAirportName(lang) }}
          items={destinations.map((item) => ({
            id: item.id,
            code: item.code,
            confirmed: item.confirmed,
            image: item.image,
            km: distanceKm(homeAirport, item.code),
            distanceText: d.distance,
            name: d.names[item.id],
            photo: d.photo[item.id],
          }))}
        />
        <Services dict={dict} lang={lang} />
        <Featured dict={dict} href={`/${lang}/services/sejours`} />
        <Comfort dict={dict} />
        <Why dict={dict} />
        <FinalCta dict={dict} lang={lang} />
      </main>
      <Footer dict={dict} lang={lang} />
    </>
  );
}
