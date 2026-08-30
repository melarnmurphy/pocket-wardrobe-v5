import { describe, expect, it } from "vitest";
import { buildPlannerGenerateInput } from "../planner-generate";

const TREND_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";

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
