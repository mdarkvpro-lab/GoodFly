"use client";

import { useSyncExternalStore } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

let registered = false;
export function registerGsap() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger, useGSAP);
  registered = true;
}

const reducedQuery = "(prefers-reduced-motion: reduce)";

function subscribeReduced(callback: () => void) {
  const mq = window.matchMedia(reducedQuery);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

/** True when the visitor asked for reduced motion. Server render assumes reduced (no motion until proven otherwise). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(reducedQuery).matches,
    () => true,
  );
}

export type Theme = "light" | "dark";

function subscribeTheme(callback: () => void) {
  window.addEventListener("gf-theme-change", callback);
  return () => window.removeEventListener("gf-theme-change", callback);
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    subscribeTheme,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => "light",
  );
}

const noopSubscribe = () => () => {};

/** Reads a browser-only value once on the client; the server render uses `serverValue`. */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => serverValue);
}

export function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Visitors on data-saver or very low memory get the still poster instead of 3D. */
export function prefersLightweight(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  return Boolean(nav.connection?.saveData) || (nav.deviceMemory !== undefined && nav.deviceMemory < 2);
}

export { gsap, ScrollTrigger, useGSAP };
