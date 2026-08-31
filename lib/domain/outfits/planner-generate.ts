import type { GenerateOutfitInput } from "@/lib/domain/outfits";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseMustIncludeGarmentIds(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!UUID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function buildPlannerGenerateInput(input: {
  pendingTrendSignalId?: string | null;
  mustIncludeGarmentIds?: string[] | null;
  occasion: string;
  dressCode: string;
  weather: string;
}): GenerateOutfitInput {
  const pending = input.pendingTrendSignalId?.trim();
  if (pending) {
    const mustInclude = parseMustIncludeGarmentIds(
      (input.mustIncludeGarmentIds ?? []).join(",")
    );
    if (mustInclude.length) {
      return {
        mode: "trend",
        trend_signal_id: pending,
        must_include_garment_ids: mustInclude
      };
    }
    return { mode: "trend", trend_signal_id: pending };
  }

  return {
    mode: "plan",
    occasion: input.occasion.trim() || null,
    dress_code: input.dressCode === "any" ? null : input.dressCode,
    weather: input.weather
  };
}
