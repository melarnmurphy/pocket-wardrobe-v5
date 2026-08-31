// Internal ranking IP — constants and rankingDelta must not surface names or values in UI.
import type { NeglectGarment } from "@/lib/domain/outfits/neglect";

const RECENCY_PENALTY = 0.3;
const RECENCY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const WEAR_PRIOR = 0.5;
const ROTATION_ALPHA = 0.35;
const IDLE_BETA = 0.45;
const DELTA_MAX = 1.2;

export function rankingDelta(garment: NeglectGarment): number {
  const wears = garment.wear_count;
  const rotation = ROTATION_ALPHA / (1 + wears);
  const price = garment.purchase_price;
  const idle =
    price == null ? 0 : IDLE_BETA * Math.log10(1 + price / (wears + WEAR_PRIOR));
  return DELTA_MAX * (1 - Math.exp(-(rotation + idle)));
}

export function recencyPenalty(
  lastWornAt: string | null | undefined,
  nowMs: number,
  windowMs = RECENCY_WINDOW_MS
): number {
  if (!lastWornAt) return 0;
  const wornAt = Date.parse(lastWornAt);
  if (Number.isNaN(wornAt)) return 0;
  return nowMs - wornAt < windowMs ? RECENCY_PENALTY : 0;
}
