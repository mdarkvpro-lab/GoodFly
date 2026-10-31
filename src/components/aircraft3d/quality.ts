"use client";

export type QualityTier = "high" | "medium" | "low";

export type QualitySettings = {
  tier: QualityTier;
  model: string;
  dpr: [number, number];
  shadowMapSize: number;
  clouds: number;
};

const MODELS = { full: "/models/goodfly-airliner.glb", lite: "/models/goodfly-airliner-lite.glb" };

export const QUALITY: Record<QualityTier, QualitySettings> = {
  high: { tier: "high", model: MODELS.full, dpr: [1, 1.75], shadowMapSize: 2048, clouds: 22 },
  medium: { tier: "medium", model: MODELS.full, dpr: [1, 1.25], shadowMapSize: 1024, clouds: 16 },
  low: { tier: "low", model: MODELS.lite, dpr: [1, 1], shadowMapSize: 0, clouds: 10 },
};

/** Picks a starting tier from the device; the scene can step down later if frames drop. */
export function detectQuality(): QualityTier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const phone = window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;
  if (phone || memory < 4 || cores < 4) return "low";
  if (memory < 8 || cores < 8) return "medium";
  return "high";
}

export const lowerTier = (tier: QualityTier): QualityTier => (tier === "high" ? "medium" : "low");
