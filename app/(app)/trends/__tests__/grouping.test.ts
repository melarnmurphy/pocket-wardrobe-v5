import { describe, expect, it } from "vitest";
import { trendSectionOrder } from "@/lib/domain/trends/matching";

describe("trendSectionOrder", () => {
  it("leads with owned matches before missing pieces", () => {
    expect(trendSectionOrder()).toEqual([
      "exact_match",
      "adjacent_match",
      "styling_match",
      "missing_piece"
    ]);
  });
});
