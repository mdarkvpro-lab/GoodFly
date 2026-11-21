"use server";

import { after } from "next/server";
import { lowReviewMessage } from "@/lib/notify/booking-message";
import { sendTelegram } from "@/lib/notify/telegram";
import { publicClient } from "@/lib/programs/data";

export type ReviewFormState = { done: true; low: boolean } | { error: "stars" | "generic" } | undefined;

/** Link to the staff page for the alert, only from configuration (never from the request's Host). */
function staffUrl() {
  const site = process.env.SITE_URL;
  return site && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(site) ? `${site}/fr/espace/avis` : undefined;
}

/** The client's review: saved as "to read" (never public before staff approve it). 1-2 stars alert the Direction. */
export async function submitReview(_prev: ReviewFormState, form: FormData): Promise<ReviewFormState> {
  const token = String(form.get("token") ?? "");
  const stars = Number(form.get("stars"));
  const comment = String(form.get("comment") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 1000);
  const showName = form.get("show_name") === "on";
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { error: "stars" };
  if (!/^[0-9a-f]{64}$/.test(token)) return { error: "generic" };

  const db = publicClient();
  const key = process.env.BOOKING_FORM_KEY;
  if (!db || !key) return { error: "generic" };
  const { data: reference, error } = await db.rpc("submit_review", { form_key: key, token, stars, review: comment, show_name: showName });
  if (error || typeof reference !== "string") return { error: "generic" };

  const low = stars <= 2;
  if (low) after(() => sendTelegram(lowReviewMessage(reference, stars, staffUrl())).then(() => undefined));
  return { done: true, low };
}
