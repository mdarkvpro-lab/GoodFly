"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import styles from "./Header.module.css";

type Item = { href: string; label: string; client?: boolean };
type Props = { items: Item[]; openLabel: string; closeLabel: string; navLabel: string };

/** Phone and tablet menu: a button that opens the same links as the desktop navigation. */
export function MobileMenu({ items, openLabel, closeLabel, navLabel }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // A link click closes it (below); Escape and the browser's Back button close it too.
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
    <div className={styles.mobile}>
      <button
        type="button"
        className={styles.iconButton}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? closeLabel : openLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <nav id={panelId} aria-label={navLabel} className={styles.panel} hidden={!open}>
        {items.map((item) =>
          item.client ? (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ) : (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ),
        )}
      </nav>
    </div>
  );
}
