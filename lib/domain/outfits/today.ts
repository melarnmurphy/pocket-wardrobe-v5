import { generateOutfit } from "./generator";
import type { GeneratedOutfit } from "@/lib/domain/outfits";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";
import type { StyleRuleListItem } from "@/lib/domain/style-rules/service";

export type TodayOutfitInput = {
  garments: GarmentListItem[];
  styleRules: StyleRuleListItem[];
  weather?: string;
  occasion?: string | null;
  dress_code?: string | null;
  recentOutfitGarmentIds?: string[];
  nowMs?: number;
};

export function suggestTodayOutfit(input: TodayOutfitInput): GeneratedOutfit {
  const nowMs = input.nowMs ?? Date.now();
  const recent = new Set(input.recentOutfitGarmentIds ?? []);
  const iso = new Date(nowMs).toISOString();
  const garments = input.garments.map((g) =>
    recent.has(g.id as string) ? { ...g, last_worn_at: iso } : g
  );
  return generateOutfit({
    mode: "plan",
    garments,
    styleRules: input.styleRules,
    trendSignal: null,
    weather: input.weather,
    occasion: input.occasion ?? undefined,
    dress_code: input.dress_code ?? undefined,
    nowMs
  });
}
