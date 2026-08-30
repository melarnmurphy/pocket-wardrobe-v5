import type { GenerateOutfitInput } from "@/lib/domain/outfits";

export function buildPlannerGenerateInput(input: {
  pendingTrendSignalId?: string | null;
  occasion: string;
  dressCode: string;
  weather: string;
}): GenerateOutfitInput {
  const pending = input.pendingTrendSignalId?.trim();
  if (pending) {
    return { mode: "trend", trend_signal_id: pending };
  }

  return {
    mode: "plan",
    occasion: input.occasion.trim() || null,
    dress_code: input.dressCode === "any" ? null : input.dressCode,
    weather: input.weather
  };
}
