"use client";

import { useActionState, useState } from "react";
import { createEmployee, type CreateEmployeeState } from "@/app/[lang]/espace/employes/actions";
import type { Locale } from "@/i18n/config";
import { PERMISSIONS } from "@/lib/staff/access";
import styles from "./staff.module.css";

type T = {
  addTitle: string;
  fullName: string;
  email: string;
  permissionsLegend: string;
  submit: string;
  createdTitle: string;
  createdHint: string;
  password: string;
  copy: string;
  copied: string;
  another: string;
  errors: Record<string, string>;
};

function Form({ lang, t, labels, onReset }: { lang: Locale; t: T; labels: Record<string, string>; onReset: () => void }) {
  const [state, action, pending] = useActionState<CreateEmployeeState, FormData>(createEmployee, undefined);
  const [copied, setCopied] = useState(false);

  if (state && "created" in state) {
    const c = state.created;
    return (
      <div className={styles.secret} role="status">
        <strong>{t.createdTitle.replace("{name}", c.fullName)}</strong>
        <span>
          {t.email} : <span dir="ltr">{c.email}</span>
        </span>
        <span>{t.password} :</span>
        <code dir="ltr">{c.password}</code>
        <p className={styles.muted}>{t.createdHint}</p>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => navigator.clipboard?.writeText(c.password).then(() => setCopied(true), () => setCopied(false))}
          >
            {copied ? t.copied : t.copy}
          </button>
          <button type="button" className={styles.button} onClick={onReset}>
            {t.another}
          </button>
        </div>
      </div>
    );
  }

  const error = state && "error" in state ? (t.errors[state.error] ?? t.errors.generic) : null;
  const values = state && "error" in state ? state : undefined;
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="lang" value={lang} />
      {error && (
        <p className={`${styles.notice} ${styles.error}`} role="alert">
          {error}
        </p>
      )}
      <div className={styles.grid2}>
        <label className={styles.label}>
          {t.fullName}
          <input className={styles.input} name="fullName" required maxLength={120} autoComplete="off" defaultValue={values?.fullName ?? ""} />
        </label>
        <label className={styles.label}>
          {t.email}
          <input className={styles.input} name="email" type="email" required maxLength={254} autoComplete="off" dir="ltr" defaultValue={values?.email ?? ""} />
        </label>
      </div>
      <fieldset className={styles.checks}>
        <legend>{t.permissionsLegend}</legend>
        {PERMISSIONS.map((p) => (
          <label key={p} className={styles.check}>
            <input type="checkbox" name="permissions" value={p} />
            {labels[p]}
          </label>
        ))}
      </fieldset>
      <div>
        <button className={styles.button} type="submit" disabled={pending}>
          {t.submit}
        </button>
      </div>
    </form>
  );
}

/** Add-employee form; the temporary password is shown once, in memory only. */
export function EmployeeForm(props: { lang: Locale; t: T; labels: Record<string, string> }) {
  const [round, setRound] = useState(0);
  return <Form key={round} {...props} onReset={() => setRound((n) => n + 1)} />;
}
