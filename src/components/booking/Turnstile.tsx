"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Cloudflare Turnstile widget. It adds the hidden "cf-turnstile-response" field to the form;
 * `resetKey` changes after each submission, because a token can be used only once.
 */
export function Turnstile({ siteKey, lang, resetKey }: { siteKey: string; lang: string; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    load()
      .then(() => {
        if (!alive || !box.current || !window.turnstile || id.current) return;
        id.current = window.turnstile.render(box.current, { sitekey: siteKey, language: lang, theme: "auto", action: "booking" });
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
    };
  }, [siteKey, lang]);

  useEffect(() => {
    if (resetKey && id.current && window.turnstile) window.turnstile.reset(id.current);
  }, [resetKey]);

  return <div ref={box} />;
}
