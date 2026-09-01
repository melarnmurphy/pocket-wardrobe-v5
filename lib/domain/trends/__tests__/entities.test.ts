import { describe, expect, it } from "vitest";
import { classifyMakerTier, rankExamplesForUser, regionOverlapsUser } from "../entities";

describe("cited makers", () => {
  it("treats Adidas as heritage and unknown labels as emerging", () => {
    expect(classifyMakerTier("Adidas")).toBe("heritage");
    expect(classifyMakerTier("Local Last Co")).toBe("emerging");
  });

  it("ranks a Melbourne maker above a heritage house for a Melbourne user", () => {
    const ranked = rankExamplesForUser(
      [
        { label: "Adidas", tier: "heritage", city: null, region: null, local: false },
        { label: "Local Last Co", tier: "emerging", city: "Melbourne", region: "Australia", local: false }
      ],
      "Melbourne, Australia"
    );
    expect(ranked?.label).toBe("Local Last Co");
    expect(ranked?.local).toBe(true);
  });

  it("does not mark local without a user location", () => {
    expect(regionOverlapsUser("Australia", "Melbourne", null)).toBe(false);
  });
});
