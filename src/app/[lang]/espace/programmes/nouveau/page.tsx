import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProgramForm } from "@/components/staff/ProgramForm";
import { StaffShell } from "@/components/staff/StaffShell";
import styles from "@/components/staff/staff.module.css";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { requireStaff } from "@/lib/staff/dal";

async function Gate({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  await requireStaff(lang, { permission: "programs.manage" });
  return <ProgramForm lang={lang} t={dict.staff.programs} initial={{ status: "draft" }} />;
}

export default async function NewProgramPage({ params }: PageProps<"/[lang]/espace/programmes/nouveau">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <StaffShell lang={lang} dict={dict}>
      <h1 className={styles.h1}>{dict.staff.programs.newTitle}</h1>
      <section className={styles.card}>
        <Suspense fallback={<p className={styles.muted}>{dict.staff.loading}</p>}>
          <Gate lang={lang} dict={dict} />
        </Suspense>
      </section>
    </StaffShell>
  );
}
