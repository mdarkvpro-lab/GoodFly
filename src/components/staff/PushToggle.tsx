"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/[lang]/espace/push-actions";
import { Icon } from "@/components/Icon";
import styles from "./staff.module.css";

type T = { title: string; intro: string; enable: string; on: string; off: string; test: string; testSent: string; denied: string; unsupported: string; error: string };
type State = "loading" | "unsupported" | "denied" | "off" | "on" | "busy";

function keyBytes(b64url: string) {
  const b64 = (b64url + "=".repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Turns booking alerts on or off for THIS phone or computer (Web Push, free). */
export function PushToggle({ lang, vapidKey, t }: { lang: string; vapidKey: string; t: T }) {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supported()) return alive && setState("unsupported");
      if (Notification.permission === "denied") return alive && setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (alive) setState(sub ? "on" : "off");
    })().catch(() => alive && setState("off"));
    return () => {
      alive = false;
    };
  }, []);

  const enable = async () => {
    setState("busy");
    setMsg("");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) }));
      const ok = await savePushSubscription(lang, sub.toJSON(), navigator.userAgent.slice(0, 120));
      if (!ok) {
        await sub.unsubscribe();
        setMsg(t.error);
        return setState("off");
      }
      setState("on");
    } catch {
      setMsg(t.error);
      setState("off");
    }
  };

  const disable = async () => {
    setState("busy");
    setMsg("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(lang, sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setMsg(t.error);
      setState("on");
    }
  };

  const test = async () => {
    setMsg("");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    setMsg(sub && (await sendTestPush(lang, sub.endpoint)) ? t.testSent : t.error);
  };

  return (
    <section className={`${styles.card} ${styles.pushCard}`} aria-labelledby="push-title">
      <div>
        <strong id="push-title">{t.title}</strong>
        <p className={styles.muted}>{t.intro}</p>
      </div>
      {state === "unsupported" && <p className={styles.muted}>{t.unsupported}</p>}
      {state === "denied" && <p className={`${styles.notice} ${styles.warn}`}>{t.denied}</p>}
      {state === "off" && (
        <div>
          <button type="button" className={styles.button} onClick={enable}>
            <Icon name="bell" size={16} /> {t.enable}
          </button>
        </div>
      )}
      {state === "busy" && <p className={styles.muted}>…</p>}
      {state === "on" && (
        <div className={styles.row}>
          <span className={`${styles.tag} ${styles.tagOn}`}>{t.on}</span>
          <button type="button" className={styles.ghost} onClick={test}>
            {t.test}
          </button>
          <button type="button" className={styles.ghost} onClick={disable}>
            {t.off}
          </button>
        </div>
      )}
      {msg && (
        <p className={styles.muted} role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
