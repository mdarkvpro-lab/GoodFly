"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import styles from "./staff.module.css";

/**
 * Staff navigation: inline on wide screens; on phones, behind a menu button so the page
 * content starts at the top of the screen. Links and the sign-out stay server-rendered (children).
 */
export function StaffMenu({ openLabel, closeLabel, children }: { openLabel: string; closeLabel: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", close);
    };
  }, [open]);

  return (
    <>
      <button type="button" className={styles.menuToggle} aria-expanded={open} aria-controls={id} aria-label={open ? closeLabel : openLabel} onClick={() => setOpen((v) => !v)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <div
        id={id}
        className={styles.collapsible}
        data-open={open}
        onClick={(e) => {
          // A chosen link (or the sign-out) closes the menu.
          if ((e.target as HTMLElement).closest("a, button[type='submit']")) setOpen(false);
        }}
      >
        {children}
      </div>
    </>
  );
}
