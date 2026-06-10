import type { OutfitWithItems } from "./index";

export type DayCell = { date: string; day: number };
export type MonthGrid = { weeks: (DayCell | null)[][] };

export function toDateKey(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// Monday-first weekday index (0=Mon … 6=Sun). Uses UTC purely for the weekday
// arithmetic — no dates are constructed from stored strings, avoiding tz drift.
function mondayIndex(year: number, month: number, day: number): number {
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun..6=Sat
  return (js + 6) % 7;
}

export function buildMonthGrid(year: number, month: number): MonthGrid {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = mondayIndex(year, month, 1);
  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: toDateKey(year, month, d), day: d });
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (DayCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { weeks };
}

const HERO_ROLE_PRIORITY = [
  "dress", "outerwear", "top", "bottom", "shoes", "bag", "accessory", "jewellery", "other"
];

export function pickHeroImage(outfit: OutfitWithItems): string | null {
  for (const role of HERO_ROLE_PRIORITY) {
    const match = outfit.items.find(
      (it) => it.role === role && !!it.garment.preview_url
    );
    if (match?.garment.preview_url) return match.garment.preview_url;
  }
  // Any item with an image, regardless of role.
  const anyWithImage = outfit.items.find((it) => !!it.garment.preview_url);
  return anyWithImage?.garment.preview_url ?? null;
}

export function bucketOutfitsByDate(
  outfits: OutfitWithItems[]
): Map<string, OutfitWithItems> {
  const map = new Map<string, OutfitWithItems>();
  for (const o of outfits) {
    const key = o.planned_for;
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || (o.created_at ?? "") > (existing.created_at ?? "")) {
      map.set(key, o);
    }
  }
  return map;
}
