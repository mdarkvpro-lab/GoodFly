"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitReview, type ReviewFormState } from "@/app/[lang]/avis/[token]/actions";
import formStyles from "@/components/booking/booking.module.css";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./reviews.module.css";

type T = Dictionary["reviewPage"];

/** 1-5 stars (real radio buttons, keyboard friendly), an optional comment and the name agreement. */
export function ReviewForm({ lang, token, t }: { lang: string; token: string; t: T }) {
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(submitReview, undefined);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const shown = hover || stars;

  if (state && "done" in state) {
    return (
      <div className={styles.done} role="status">
        <h2 className={styles.doneTitle}>{t.doneTitle}</h2>
        <p>{t.doneText}</p>
        {state.low && <p>{t.doneLow}</p>}
        <Link className={formStyles.submit} href={`/${lang}`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
          {t.home}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className={formStyles.form}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="lang" value={lang} />
      <fieldset className={formStyles.group}>
        <legend>{t.stars}</legend>
        <div className={styles.stars} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={styles.star} data-on={n <= shown} onMouseEnter={() => setHover(n)}>
              <input type="radio" name="stars" value={n} required checked={stars === n} onChange={() => setStars(n)} />
              <span aria-hidden="true">★</span>
              <span className={styles.sr}>{t.starLabel.replace("{n}", String(n))}</span>
            </label>
          ))}
        </div>
        <p className={formStyles.hint} aria-live="polite">
          {shown ? t.starHints[shown - 1] : " "}
        </p>
        {state && "error" in state && state.error === "stars" && <p className={formStyles.fieldError}>{t.errorStars}</p>}
      </fieldset>

      <label className={formStyles.label}>
        {t.comment}
        <textarea className={formStyles.textarea} name="comment" maxLength={1000} dir="auto" placeholder={t.commentHint} />
      </label>

      <label className={formStyles.consent}>
        <input type="checkbox" name="show_name" />
        <span>{t.showName}</span>
      </label>
      <p className={formStyles.hint}>{t.notice}</p>

      {state && "error" in state && state.error === "generic" && (
        <p className={formStyles.alert} role="alert">
          {t.errorGeneric}
        </p>
      )}
      <div>
        <button className={formStyles.submit} type="submit" disabled={pending}>
          {pending ? t.sending : t.submit}
        </button>
      </div>
    </form>
  );
}
