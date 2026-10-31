"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "@/app/[lang]/espace/actions";
import type { Locale } from "@/i18n/config";
import styles from "./staff.module.css";

type Props = {
  lang: Locale;
  t: { email: string; password: string; submit: string; errors: Record<string, string> };
  initialError?: string;
};

export function LoginForm({ lang, t, initialError }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, initialError ? { error: initialError } : undefined);
  const error = state?.error ? (t.errors[state.error] ?? t.errors.credentials) : null;
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="lang" value={lang} />
      {error && (
        <p className={`${styles.notice} ${styles.error}`} role="alert">
          {error}
        </p>
      )}
      <label className={styles.label}>
        {t.email}
        <input className={styles.input} name="email" type="email" autoComplete="username" required dir="ltr" defaultValue={state?.email ?? ""} key={state?.email ?? ""} />
      </label>
      <label className={styles.label}>
        {t.password}
        <input className={styles.input} name="password" type="password" autoComplete="current-password" required dir="ltr" />
      </label>
      <button className={styles.button} type="submit" disabled={pending}>
        {t.submit}
      </button>
    </form>
  );
}
