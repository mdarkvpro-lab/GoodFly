"use client";

import styles from "./Header.module.css";

type Props = { label: string };

export function ThemeToggle({ label }: Props) {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("gf-theme", next);
    } catch {
      // Storage can be blocked (private mode); the theme still applies for this visit.
    }
    window.dispatchEvent(new CustomEvent("gf-theme-change", { detail: next }));
  }

  return (
    <button type="button" className={styles.iconButton} aria-label={label} onClick={toggle}>
      {/* Moon in light theme, sun in dark theme — switched with CSS so the server render matches */}
      <svg className={styles.moon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg className={styles.sun} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
