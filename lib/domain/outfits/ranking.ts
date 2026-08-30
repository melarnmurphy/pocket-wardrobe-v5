const RECENCY_PENALTY = 0.3;
const RECENCY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type NeglectGarment = {
  purchase_price?: number | null;
  wear_count: number;
};

export function valueNeglect(garment: NeglectGarment): number | null {
  if (garment.purchase_price == null) return null;
  return garment.purchase_price / Math.max(garment.wear_count, 1);
}

export function compareNeglected(left: NeglectGarment, right: NeglectGarment): number {
  const leftNeglect = valueNeglect(left);
  const rightNeglect = valueNeglect(right);

  if (leftNeglect == null && rightNeglect == null) return 0;
  if (leftNeglect == null) return 1;
  if (rightNeglect == null) return -1;

  return rightNeglect - leftNeglect;
}

export function costPerWearBoost(garment: NeglectGarment): number {
  const neglect = valueNeglect(garment);
  if (neglect == null) return 0;
  const logged = Math.log10(1 + neglect) * 0.35;
  const unusedBonus = garment.wear_count === 0 ? 0.25 : 0;
  return Math.min(1.5, logged + unusedBonus);
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
