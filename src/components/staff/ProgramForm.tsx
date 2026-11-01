"use client";

import { useActionState } from "react";
import { saveProgram, type ProgramFormState } from "@/app/[lang]/espace/programmes/actions";
import type { Locale } from "@/i18n/config";
import styles from "./staff.module.css";

export type ProgramFormValues = Partial<Record<string, string>> & { id?: string; image_url?: string };

type T = {
  fields: Record<string, string>;
  statuses: Record<string, string>;
  hints: Record<string, string>;
  errors: Record<string, string>;
  save: string;
  removeImage: string;
  currentImage: string;
};

export function ProgramForm({ lang, t, initial }: { lang: Locale; t: T; initial: ProgramFormValues }) {
  const [state, action, pending] = useActionState<ProgramFormState, FormData>(saveProgram, undefined);
  const v = (k: string) => state?.values?.[k] ?? initial[k] ?? "";
  const err = (k: string) => {
    const code = (state?.errors as Record<string, string> | undefined)?.[k];
    return code ? (
      <span className={styles.fieldError} id={`${k}-error`}>
        {t.errors[`${k}.${code}`] ?? t.errors[code] ?? t.errors.generic}
      </span>
    ) : null;
  };
  const aria = (k: string) => ((state?.errors as Record<string, string> | undefined)?.[k] ? { "aria-invalid": true, "aria-describedby": `${k}-error` } : {});
  // Remount fields with the server's echo after an error, so typed text is kept.
  const k = JSON.stringify(state?.values ?? {}).length;

  const input = (name: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={styles.label}>
      {t.fields[name]}
      <input key={`${name}-${k}`} className={styles.input} name={name} defaultValue={v(name)} {...aria(name)} {...props} />
      {t.hints[name] && <span className={styles.muted}>{t.hints[name]}</span>}
      {err(name)}
    </label>
  );
  const area = (name: string, max: number, dir?: "rtl") => (
    <label className={styles.label}>
      {t.fields[name]}
      <textarea key={`${name}-${k}`} className={styles.textarea} name={name} maxLength={max} defaultValue={v(name)} dir={dir} {...aria(name)} />
      {err(name)}
    </label>
  );

  return (
    <form action={action} className={styles.form} encType="multipart/form-data">
      <input type="hidden" name="lang" value={lang} />
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {(state?.error || state?.errors) && (
        <p className={`${styles.notice} ${styles.error}`} role="alert">
          {state.error ? t.errors[state.error] : t.errors.check}
        </p>
      )}

      <div className={styles.grid2}>
        {input("title_fr", { required: true, minLength: 3, maxLength: 120 })}
        {input("title_ar", { maxLength: 120, dir: "rtl" })}
        {input("slug", { maxLength: 80, dir: "ltr", pattern: "[a-z0-9]+(-[a-z0-9]+)*" })}
        {input("destination", { maxLength: 80 })}
      </div>
      <div className={styles.grid2}>
        {area("summary_fr", 300)}
        {area("summary_ar", 300, "rtl")}
      </div>
      <div className={styles.grid2}>
        {area("description_fr", 5000)}
        {area("description_ar", 5000, "rtl")}
      </div>
      <div className={styles.grid2}>
        {input("start_date", { type: "date" })}
        {input("end_date", { type: "date" })}
        {input("duration_days", { type: "number", min: 1, max: 90, inputMode: "numeric" })}
        {input("price_from_mad", { type: "number", min: 0, max: 10000000, inputMode: "numeric" })}
      </div>

      <div className={styles.grid2}>
        <label className={styles.label}>
          {t.fields.image}
          <input className={styles.input} name="image" type="file" accept="image/jpeg,image/png,image/webp" {...aria("image")} />
          <span className={styles.muted}>{t.hints.image}</span>
          {err("image")}
        </label>
        {initial.image_url && (
          <div className={styles.label}>
            {t.currentImage}
            {/* eslint-disable-next-line @next/next/no-img-element -- small preview of an uploaded photo */}
            <img className={styles.thumb} src={initial.image_url} alt="" width={96} height={64} />
            <label className={styles.check}>
              <input type="checkbox" name="removeImage" />
              {t.removeImage}
            </label>
          </div>
        )}
      </div>

      <label className={styles.label}>
        {t.fields.status}
        <select key={`status-${k}`} className={styles.input} name="status" defaultValue={v("status") || "draft"}>
          {(["draft", "published", "archived"] as const).map((s) => (
            <option key={s} value={s}>
              {t.statuses[s]}
            </option>
          ))}
        </select>
      </label>

      <div>
        <button className={styles.button} type="submit" disabled={pending}>
          {t.save}
        </button>
      </div>
    </form>
  );
}
