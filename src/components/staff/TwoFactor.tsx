"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  confirmEnrollment,
  recoverWithBackupCode,
  regenerateBackupCodes,
  startEnrollment,
  verifyTwoFactor,
  type ChallengeState,
  type CodesState,
  type EnrollStart,
  type EnrollState,
  type RecoveryState,
} from "@/app/[lang]/espace/two-factor-actions";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./staff.module.css";

type T = Dictionary["staff"]["twoFactor"];

const Alert = ({ text }: { text: string | null }) =>
  text ? (
    <p className={`${styles.notice} ${styles.error}`} role="alert">
      {text}
    </p>
  ) : null;

/** The 6-digit code field (numbers keyboard on phones, filled by password managers / SMS-style autofill). */
const CodeField = ({ label }: { label: string }) => (
  <label className={styles.label}>
    {label}
    <input
      className={`${styles.input} ${styles.otp}`}
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9٠-٩۰-۹ ]{6,7}"
      maxLength={7}
      required
      autoFocus
      dir="ltr"
    />
  </label>
);

/** Copies a text (falls back silently when the browser refuses). */
function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.row}>
      <button
        type="button"
        className={styles.ghost}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {label}
      </button>
      {copied && (
        <span className={styles.muted} role="status">
          {done}
        </span>
      )}
    </div>
  );
}

/** The 10 backup codes, shown once, with a copy button. */
export function BackupCodes({ codes, t, next }: { codes: string[]; t: T; next?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className={styles.form}>
      <h2 className={styles.h2}>{t.codesTitle}</h2>
      <p className={styles.muted}>{t.codesIntro}</p>
      <ol className={styles.backupCodes} dir="ltr">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className={styles.row}>
        <button type="button" className={styles.ghost} onClick={copy}>
          {t.copy}
        </button>
        {copied && (
          <span className={styles.muted} role="status">
            {t.copied}
          </span>
        )}
      </div>
      {next && (
        <a className={styles.button} href={next}>
          {t.done}
        </a>
      )}
    </div>
  );
}

/** First setup: QR code → first code → backup codes. */
export function EnrollFlow({ lang, t, next }: { lang: Locale; t: T; next: string }) {
  const [start, setStart] = useState<EnrollStart | null>(null);
  const [starting, startTransition] = useTransition();
  const [state, action, pending] = useActionState<EnrollState, FormData>(confirmEnrollment, undefined);

  if (state?.codes) return <BackupCodes codes={state.codes} t={t} next={next} />;
  if (!start || "error" in start) {
    return (
      <div className={styles.form}>
        <Alert text={start && "error" in start ? (t.errors[start.error] ?? t.errors.generic) : null} />
        {start && "error" in start && start.error === "already" ? (
          <a className={styles.button} href={next}>
            {t.done}
          </a>
        ) : (
          <button type="button" className={styles.button} disabled={starting} onClick={() => startTransition(async () => setStart(await startEnrollment(lang)))}>
            {t.start}
          </button>
        )}
      </div>
    );
  }
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="factorId" value={start.factorId} />
      <p className={styles.muted}>{t.openInAppHint}</p>
      {/* otpauth:// opens the authenticator app on the same phone (no scanning needed). */}
      <a className={styles.button} href={start.uri}>
        {t.openInApp}
      </a>
      <p>{t.step1}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- QR code returned by Supabase Auth as an SVG data URI */}
      <img className={styles.qr} src={start.qr} alt="" width={200} height={200} />
      <p className={styles.muted}>{t.manual}</p>
      <code className={styles.totpKey} dir="ltr">
        {start.secret}
      </code>
      <CopyButton text={start.secret} label={t.copyKey} done={t.keyCopied} />
      <p>{t.step2}</p>
      <Alert text={state?.error ? (t.errors[state.error] ?? t.errors.generic) : null} />
      <CodeField label={t.code} />
      <button className={styles.button} type="submit" disabled={pending}>
        {t.confirm}
      </button>
    </form>
  );
}

/** Each sign-in: the code from the app. */
export function ChallengeForm({ lang, t, recoveryHref }: { lang: Locale; t: T; recoveryHref: string }) {
  const [state, action, pending] = useActionState<ChallengeState, FormData>(verifyTwoFactor, undefined);
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="lang" value={lang} />
      <Alert text={state?.error ? (t.errors[state.error] ?? t.errors.generic) : null} />
      <CodeField label={t.code} />
      <button className={styles.button} type="submit" disabled={pending}>
        {t.verify}
      </button>
      <Link href={recoveryHref}>{t.lostPhone}</Link>
    </form>
  );
}

/** Lost phone: a backup code. */
export function RecoveryForm({ lang, t, backHref }: { lang: Locale; t: T; backHref: string }) {
  const [state, action, pending] = useActionState<RecoveryState, FormData>(recoverWithBackupCode, undefined);
  const error = state?.error ? (state.error === "wrong" ? t.errors.wrongBackup : (t.errors[state.error] ?? t.errors.generic)) : null;
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="lang" value={lang} />
      <Alert text={error} />
      <label className={styles.label}>
        {t.backupCode}
        <input className={`${styles.input} ${styles.otp}`} name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={14} required autoFocus dir="ltr" placeholder="ABCDE-23456" />
      </label>
      <button className={styles.button} type="submit" disabled={pending}>
        {t.useCode}
      </button>
      <p className={styles.muted}>{t.noCodes}</p>
      <Link href={backHref}>{t.back}</Link>
    </form>
  );
}

/** "Mon compte": new backup codes. */
export function RegenerateCodes({ lang, t }: { lang: Locale; t: T }) {
  const [state, action, pending] = useActionState<CodesState, FormData>(regenerateBackupCodes, undefined);
  if (state?.codes) return <BackupCodes codes={state.codes} t={t} />;
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="lang" value={lang} />
      <Alert text={state?.error ? t.errors.generic : null} />
      <button className={styles.ghost} type="submit" disabled={pending}>
        {t.regenerate}
      </button>
      <span className={styles.muted}>{t.regenerateHint}</span>
    </form>
  );
}
