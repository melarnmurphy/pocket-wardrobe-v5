import { describe, expect, it } from "vitest";
import { generateOutfitInputSchema } from "@/lib/domain/outfits";
import { buildPlannerGenerateInput, parseMustIncludeGarmentIds } from "../planner-generate";

const TREND_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";
const GARMENT_A = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1";
const GARMENT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2";

describe("parseMustIncludeGarmentIds", () => {
  it("parses unique uuid values from a comma-separated query", () => {
    expect(parseMustIncludeGarmentIds(`${GARMENT_A},${GARMENT_B},${GARMENT_A}`)).toEqual([
      GARMENT_A,
      GARMENT_B
    ]);
  });
});

describe("buildPlannerGenerateInput", () => {
  it("uses trend mode only while a pending landing trend remains", () => {
    expect(
      buildPlannerGenerateInput({
        pendingTrendSignalId: TREND_ID,
        occasion: "Work Day",
        dressCode: "business_casual",
        weather: "cool_breeze"
      })
    ).toEqual({ mode: "trend", trend_signal_id: TREND_ID });
  });

  it("forwards must-include garment ids on the trend variant", () => {
    const input = buildPlannerGenerateInput({
      pendingTrendSignalId: TREND_ID,
      mustIncludeGarmentIds: [GARMENT_A, GARMENT_B],
      occasion: "Work Day",
      dressCode: "business_casual",
      weather: "cool_breeze"
    });
    expect(input).toEqual({
      mode: "trend",
      trend_signal_id: TREND_ID,
      must_include_garment_ids: [GARMENT_A, GARMENT_B]
    });
    expect(generateOutfitInputSchema.parse(input)).toEqual(input);
  });

  it("uses that day's plan weather, occasion, and dress code after the landing trend is consumed", () => {
    expect(
      buildPlannerGenerateInput({
        pendingTrendSignalId: null,
        occasion: "Dinner",
        dressCode: "smart_casual",
        weather: "mild_clear"
      })
    ).toEqual({
      mode: "plan",
      occasion: "Dinner",
      dress_code: "smart_casual",
      weather: "mild_clear"
    });
  });
});
