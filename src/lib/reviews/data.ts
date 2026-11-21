import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { publicClient } from "@/lib/programs/data";

export type PublicReview = {
  id: string;
  rating: number;
  comment: string;
  /** "Fatima Z." only when the client agreed, else empty. */
  name: string;
  destination: string;
  trip_month: string | null;
  lang: "fr" | "ar";
};

/** Reviews approved by staff (safe columns only), refreshed as soon as one is published or withdrawn. */
export async function getPublicReviews(): Promise<PublicReview[]> {
  "use cache";
  cacheTag("reviews");
  cacheLife("hours");
  const db = publicClient();
  if (!db) return [];
  const { data, error } = await db.rpc("public_reviews");
  if (error) {
    console.error("[reviews] list failed:", error.message);
    return [];
  }
  return (data ?? []) as PublicReview[];
}
