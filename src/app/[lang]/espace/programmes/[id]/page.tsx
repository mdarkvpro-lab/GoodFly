import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { ProgramForm } from "@/components/staff/ProgramForm";
import { StaffShell } from "@/components/staff/StaffShell";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { programImageUrl } from "@/lib/programs/data";
import { getStaffProgram } from "@/lib/staff/dal";

async function Editor({ lang, dict, params }: { lang: Locale; dict: Dictionary; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getStaffProgram(lang, id);
  if (!p) notFound();
  const str = (n: number | null) => (n === null ? "" : String(n));
  return (
    <ProgramForm
      lang={lang}
      t={dict.staff.programs}
      initial={{
        id: p.id,
        slug: p.slug,
        status: p.status,
        title_fr: p.title_fr,
        title_ar: p.title_ar,
        summary_fr: p.summary_fr,
        summary_ar: p.summary_ar,
        description_fr: p.description_fr,
        description_ar: p.description_ar,
        destination: p.destination,
        start_date: p.start_date ?? "",
        end_date: p.end_date ?? "",
        duration_days: str(p.duration_days),
        price_from_mad: str(p.price_from_mad),
        image_url: programImageUrl(p.image_path) ?? undefined,
      }}
    />
  );
}

export default async function EditProgramPage({ params }: PageProps<"/[lang]/espace/programmes/[id]">) {
  // The id is only known at request time: read the language from the root param, the id inside Suspense.
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <StaffShell lang={lang} dict={dict}>
      <h1 className={styles.h1}>{dict.staff.programs.editTitle}</h1>
      <section className={styles.card}>
        <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
          <Editor lang={lang} dict={dict} params={params} />
        </Suspense>
      </section>
    </StaffShell>
  );
}
