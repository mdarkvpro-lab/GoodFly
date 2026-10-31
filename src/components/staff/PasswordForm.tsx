"use client";

import { useActionState } from "react";
import { changePassword, type FormState } from "@/app/[lang]/espace/actions";
import type { Locale } from "@/i18n/config";
import styles from "./staff.module.css";

type Props = {
  lang: Locale;
  t: { password: string; confirm: string; hint: string; submit: string; errors: Record<string, string> };
};

export function PasswordForm({ lang, t }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, undefined);
  const error = state?.error ? (t.errors[state.error] ?? t.errors.generic) : null;
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="lang" value={lang} />
      {error && (
        <p className={`${styles.notice} ${styles.error}`} role="alert">
          {error}
        </p>
      )}
      <label className={styles.label}>
        {t.password}
        <input className={styles.input} name="password" type="password" autoComplete="new-password" minLength={12} required dir="ltr" />
        <span className={styles.muted}>{t.hint}</span>
      </label>
      <label className={styles.label}>
        {t.confirm}
        <input className={styles.input} name="confirm" type="password" autoComplete="new-password" minLength={12} required dir="ltr" />
      </label>
      <button className={styles.button} type="submit" disabled={pending}>
        {t.submit}
      </button>
    </form>
  );
}
