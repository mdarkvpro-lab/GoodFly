"use server";

import { defaultLocale, isLocale } from "@/i18n/config";
import { PUSH_ENDPOINT, pushToDevice } from "@/lib/notify/push";
import { requireStaff } from "@/lib/staff/dal";

/** Registers / removes this device for booking alerts (own account only; RLS enforces the same). */

type Sub = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
const B64 = (min: number, max: number) => new RegExp(`^[A-Za-z0-9_-]{${min},${max}}$`);

export async function savePushSubscription(langValue: string, sub: Sub, device: string): Promise<boolean> {
  const lang = isLocale(langValue) ? langValue : defaultLocale;
  const { supabase, user } = await requireStaff(lang, { permission: "bookings.manage" });
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth : "";
  if (endpoint.length > 1000 || !PUSH_ENDPOINT.test(endpoint) || !B64(80, 100).test(p256dh) || !B64(16, 32).test(auth)) return false;
  // Same browser re-subscribing: replace its previous row.
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await supabase
    .from("push_subscriptions")
    .insert({ user_id: user.id, endpoint, p256dh, auth, device: String(device ?? "").slice(0, 120) });
  return !error;
}

export async function removePushSubscription(langValue: string, endpoint: string): Promise<boolean> {
  const lang = isLocale(langValue) ? langValue : defaultLocale;
  const { supabase } = await requireStaff(lang, { allowPasswordChange: true });
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return !error;
}

/** Test notification to this device only (RLS: the row must belong to the caller). */
export async function sendTestPush(langValue: string, endpoint: string): Promise<boolean> {
  const lang = isLocale(langValue) ? langValue : defaultLocale;
  const { supabase } = await requireStaff(lang, { permission: "bookings.manage" });
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  const { data } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("endpoint", endpoint).maybeSingle();
  if (!data) return false;
  return pushToDevice(data, {
    title: lang === "ar" ? "✅ تنبيهات GoodFly تعمل" : "✅ Alertes GoodFly actives",
    body: lang === "ar" ? "ستتوصل هنا بطلبات الحجز الجديدة." : "Les nouvelles demandes de réservation arriveront ici.",
    url: `/${lang}/espace/reservations`,
    tag: "goodfly-test",
  });
}
