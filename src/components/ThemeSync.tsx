"use client";

import { useLayoutEffect } from "react";

/**
 * Keeps the chosen theme when React renders a new <html> on the client
 * (switching FR ↔ AR swaps the root layout; the inline theme script only runs on a full page load).
 * Runs before the browser paints, so the page never flashes the other theme.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (root.dataset.theme === "light" || root.dataset.theme === "dark") return;
    let theme: string | null = null;
    try {
      theme = localStorage.getItem("gf-theme");
    } catch {
      // Storage can be blocked (private mode): fall back to the system setting.
    }
    if (theme !== "light" && theme !== "dark") theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    root.dataset.theme = theme;
    window.dispatchEvent(new CustomEvent("gf-theme-change", { detail: theme }));
  }, []);
  return null;
}
