"use client";

import { useActionState, useState } from "react";
import { resetEmployeePassword, type ResetPasswordState } from "@/app/[lang]/espace/employes/actions";
import styles from "./staff.module.css";

type T = { button: string; hint: string; confirm: string; done: string; doneHint: string; copy: string; copied: string; left: string; errors: Record<string, string> };

/** Direction gives a forgotten-password employee a new temporary password, shown once. */
export function ResetPassword({ lang, id, left, t }: { lang: string; id: string; left: number; t: T }) {
  const [state, action, pending] = useActionState<ResetPasswordState, FormData>(resetEmployeePassword, undefined);
  const [copied, setCopied] = useState(false);

  if (state && "password" in state) {
    return (
      <div className={styles.secret} role="status">
        <strong>{t.done}</strong>
        <code dir="ltr">{state.password}</code>
        <p className={styles.muted}>{t.doneHint}</p>
        <div>
          <button type="button" className={styles.ghost} onClick={() => navigator.clipboard?.writeText(state.password).then(() => setCopied(true), () => setCopied(false))}>
            {copied ? t.copied : t.copy}
          </button>
        </div>
      </div>
    );
  }

  return (
    <details className={styles.more}>
      <summary>{t.button}</summary>
      <form action={action} className={styles.form}>
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="id" value={id} />
        <p className={styles.muted}>{t.hint}</p>
        <p className={styles.muted}>{t.left.replace("{n}", String(left))}</p>
        {state && "error" in state && (
          <p className={`${styles.notice} ${styles.error}`} role="alert">
            {t.errors[state.error] ?? t.errors.generic}
          </p>
        )}
        <div>
          <button className={styles.button} type="submit" disabled={pending || left <= 0}>
            {t.confirm}
          </button>
        </div>
      </form>
    </details>
  );
}
