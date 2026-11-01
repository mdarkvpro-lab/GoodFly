import "server-only";
import webpush from "web-push";
import { publicClient } from "@/lib/programs/data";

/** Same rule as the database: only the browsers' official push services. */
export const PUSH_ENDPOINT =
  /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;

export type PushPayload = { title: string; body: string; url: string; tag: string };

function vapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return {
    vapidDetails: { subject: process.env.VAPID_SUBJECT || "mailto:goodfly64@gmail.com", publicKey, privateKey },
    TTL: 12 * 3600,
    urgency: "high" as const,
    timeout: 8000,
  };
}

/** One device (the caller's own, already checked): used by "Envoyer un test". */
export async function pushToDevice(sub: { endpoint: string; p256dh: string; auth: string }, payload: PushPayload): Promise<boolean> {
  const options = vapid();
  if (!options || !PUSH_ENDPOINT.test(sub.endpoint)) return false;
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), options);
    return true;
  } catch (e) {
    console.error("[push] test failed:", (e as { statusCode?: number })?.statusCode ?? "network");
    return false;
  }
}

/**
 * Sends a Web Push notification to every staff device allowed to manage bookings.
 * Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and the booking form key. Never throws.
 */
export async function pushToBookingStaff(payload: PushPayload): Promise<number> {
  const options = vapid();
  const formKey = process.env.BOOKING_FORM_KEY;
  const db = publicClient();
  if (!options || !formKey || !db) return 0;

  const { data, error } = await db.rpc("booking_push_targets", { form_key: formKey });
  if (error) {
    console.error("[push] targets failed:", error.code);
    return 0;
  }
  const targets = ((data ?? []) as { endpoint: string; p256dh: string; auth: string }[]).filter((t) => PUSH_ENDPOINT.test(t.endpoint));
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    targets.map((t) => webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, body, options)),
  );
  let sent = 0;
  await Promise.all(
    results.map(async (r, i) => {
      if (r.status === "fulfilled") return void sent++;
      const code = (r.reason as { statusCode?: number })?.statusCode;
      // 404/410: the device unsubscribed or the subscription expired.
      if (code === 404 || code === 410) await db.rpc("forget_push_endpoint", { form_key: formKey, gone: targets[i].endpoint });
      else console.error("[push] send failed:", code ?? "network");
    }),
  );
  return sent;
}

type DbClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }> };

/**
 * Phone/computer alert to ANOTHER Direction account (removal/restore requests and decisions).
 * Called with the signed-in Direction user's client: the database checks the role and the form key.
 */
export async function pushToDirection(db: DbClient, recipient: string, payload: PushPayload): Promise<number> {
  const options = vapid();
  const formKey = process.env.BOOKING_FORM_KEY;
  if (!options || !formKey) return 0;
  const { data, error } = await db.rpc("direction_push_targets", { form_key: formKey, recipient });
  if (error) {
    console.error("[push] direction targets failed:", error.code);
    return 0;
  }
  const targets = ((data ?? []) as { endpoint: string; p256dh: string; auth: string }[]).filter((t) => PUSH_ENDPOINT.test(t.endpoint));
  const results = await Promise.allSettled(
    targets.map((t) => webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, JSON.stringify(payload), options)),
  );
  let sent = 0;
  await Promise.all(
    results.map(async (r, i) => {
      if (r.status === "fulfilled") return void sent++;
      const code = (r.reason as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) await db.rpc("forget_push_endpoint", { form_key: formKey, gone: targets[i].endpoint });
      else console.error("[push] direction send failed:", code ?? "network");
    }),
  );
  return sent;
}
