"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitBooking, type BookingFormState } from "@/app/[lang]/reservation/actions";
import type { Locale } from "@/i18n/config";
import { Icon } from "@/components/Icon";
import { Turnstile } from "./Turnstile";
import styles from "./booking.module.css";

export type BookingFormText = {
  fields: Record<string, string>;
  hints: Record<string, string>;
  errors: Record<string, string>;
  consent: string;
  submit: string;
  sending: string;
  required: string;
  doneTitle: string;
  doneText: string;
  doneRef: string;
  doneHome: string;
  donePrograms: string;
};

type Props = { lang: Locale; t: BookingFormText; initial: Record<string, string>; programLocked: boolean; turnstileSiteKey?: string };

export function BookingForm({ lang, t, initial, programLocked, turnstileSiteKey }: Props) {
  const [state, action, pending] = useActionState<BookingFormState, FormData>(submitBooking, undefined);
  // Each answer from the server needs a fresh anti-robot token.
  const [attempt, setAttempt] = useState(0);
  const [seen, setSeen] = useState<BookingFormState>(undefined);
  if (state !== seen) {
    setSeen(state);
    setAttempt((n) => n + 1);
  }

  if (state && "reference" in state) {
    return (
      <div className={styles.done} role="status">
        <h2 className={styles.doneTitle}>
          <Icon name="check" size={26} /> {t.doneTitle}
        </h2>
        <p>{t.doneText}</p>
        <p className={styles.refLabel}>{t.doneRef}</p>
        <p className={styles.ref} dir="ltr">
          {state.reference}
        </p>
        <div className={styles.doneLinks}>
          <Link href={`/${lang}`}>{t.doneHome}</Link>
          <Link href={`/${lang}/programmes`}>{t.donePrograms}</Link>
        </div>
      </div>
    );
  }

  const values = state?.values;
  const errors = (state && "errors" in state ? state.errors : undefined) as Record<string, string> | undefined;
  const v = (k: string) => values?.[k] ?? initial[k] ?? "";
  // Remount fields with the server's echo after an error, so typed text is kept.
  const key = values ? JSON.stringify(values).length : 0;
  const err = (k: string) =>
    errors?.[k] ? (
      <span className={styles.fieldError} id={`${k}-error`}>
        {t.errors[`${k}.${errors[k]}`] ?? t.errors[errors[k]] ?? t.errors.generic}
      </span>
    ) : null;
  const aria = (k: string) => (errors?.[k] ? { "aria-invalid": true as const, "aria-describedby": `${k}-error` } : {});
  const field = (name: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, required = false) => (
    <label className={styles.label}>
      <span>
        {t.fields[name]}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <input key={`${name}-${key}`} className={styles.input} name={name} defaultValue={v(name)} required={required} {...aria(name)} {...props} />
      {t.hints[name] && <span className={styles.hint}>{t.hints[name]}</span>}
      {err(name)}
    </label>
  );
  const topError = state && "error" in state && state.error ? (t.errors[state.error] ?? t.errors.generic) : null;

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="lang" value={lang} />
      {programLocked && <input type="hidden" name="program" value={initial.program} />}
      {initial.service && <input type="hidden" name="service" value={initial.service} />}
      {/* Spam trap: invisible to people, filled by bots. */}
      <div className={styles.trap} aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {topError && (
        <p className={styles.alert} role="alert">
          {topError}
        </p>
      )}
      <p className={styles.hint}>{t.required}</p>

      <fieldset className={styles.group}>
        <legend>{t.fields.contact}</legend>
        <div className={styles.grid}>
          {field("full_name", { autoComplete: "name", maxLength: 120, minLength: 2 }, true)}
          {field("phone", { type: "tel", autoComplete: "tel", inputMode: "tel", maxLength: 25, dir: "ltr" }, true)}
          {field("email", { type: "email", autoComplete: "email", maxLength: 254, dir: "ltr" })}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>{t.fields.trip}</legend>
        <div className={styles.grid}>
          {!programLocked && initial.service !== "visa" && field("from_place", { maxLength: 120, autoComplete: "off" })}
          {!programLocked && field("to_place", { maxLength: 120, autoComplete: "off" }, true)}
          {field("travel_dates", { maxLength: 120, autoComplete: "off" })}
          {field("adults", { type: "number", min: 1, max: 20, inputMode: "numeric" }, true)}
          {field("children", { type: "number", min: 0, max: 20, inputMode: "numeric" })}
        </div>
        <label className={styles.label}>
          <span>{t.fields.message}</span>
          <textarea key={`message-${key}`} className={styles.textarea} name="message" maxLength={1000} defaultValue={v("message")} dir="auto" {...aria("message")} />
          {err("message")}
        </label>
      </fieldset>

      <label className={styles.consent}>
        <input type="checkbox" name="consent" required {...aria("consent")} />
        <span>{t.consent}</span>
      </label>
      {err("consent")}

      {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} lang={lang} resetKey={attempt} />}

      <div>
        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? t.sending : t.submit}
        </button>
      </div>
    </form>
  );
}
