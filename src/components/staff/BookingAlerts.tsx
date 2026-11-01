"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import styles from "./staff.module.css";

type T = { title: string; open: string; dismiss: string };

/** Short two-tone chime made in the browser (no audio file). Browsers may mute it until the page was clicked once. */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.32);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // no sound available
  }
}

/**
 * Live alert when a client sends a booking request while the staff area is open:
 * banner + chime + tab title; the list and the menu counter refresh by themselves.
 * (Phone/computer notifications when the site is closed come from Web Push: PushToggle.) Realtime applies the table's
 * RLS, so only accounts allowed to manage bookings receive anything.
 */
export function BookingAlerts({ href, t }: { href: string; t: T }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const baseTitle = useRef("");

  useEffect(() => {
    baseTitle.current = document.title;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel("staff-bookings")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "booking_requests" }, (payload) => {
          // Accounts without access get an empty event with an error: ignore it.
          const row = payload.new as { reference?: string };
          if (payload.errors?.length || !row?.reference) return;
          setCount((n) => n + 1);
          chime();
          router.refresh();
        })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    if (!baseTitle.current) return;
    document.title = count ? `(${count}) ${baseTitle.current}` : baseTitle.current;
  }, [count]);

  return (
    <>
      {count > 0 && (
        <div className={styles.liveAlert} role="status">
          <strong>
            {t.title} ({count})
          </strong>
          <Link href={href} onClick={() => setCount(0)}>
            {t.open}
          </Link>
          <button type="button" className={styles.ghost} onClick={() => setCount(0)}>
            {t.dismiss}
          </button>
        </div>
      )}
    </>
  );
}
