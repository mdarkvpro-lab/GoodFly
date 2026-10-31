import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./staff.module.css";

type Search = Record<string, string | string[] | undefined>;

/** Shows a known success (?m=) or error (?e=) message. Only dictionary keys are rendered, never URL text. */
export async function Notice({ searchParams, dict }: { searchParams: Promise<Search>; dict: Dictionary }) {
  const q = await searchParams;
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const m = pick(q.m);
  const e = pick(q.e);
  const ok = m ? (dict.staff.messages as Record<string, string>)[m] : undefined;
  const err = e ? (dict.staff.errors as Record<string, string>)[e] : undefined;
  if (err) {
    return (
      <p className={`${styles.notice} ${styles.error}`} role="alert">
        {err}
      </p>
    );
  }
  if (ok) {
    return (
      <p className={`${styles.notice} ${styles.ok}`} role="status">
        {ok}
      </p>
    );
  }
  return null;
}
