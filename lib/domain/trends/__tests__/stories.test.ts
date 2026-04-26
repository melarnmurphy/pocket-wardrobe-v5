import { describe, it, expect } from "vitest";
import { trendStorySchema, trendPersonSchema, STORY_DOMINANT_TYPES } from "../index";

describe("trendStorySchema", () => {
  it("parses a complete story", () => {
    const raw = {
      id: "00000000-0000-0000-0000-000000000001",
      headline: "Transparent Denim",
      framing: "The season's most literal take on exposed dressing.",
      momentum_label: "+100% search interest",
      dominant_type: "garment_moment",
      attributed_houses: ["Coperni", "Acne Studios"],
      attributed_people: [],
      signal_ids: ["00000000-0000-0000-0000-000000000002"],
      status: "emerging",
      confidence_score: 0.82
    };
    const result = trendStorySchema.parse(raw);
    expect(result.headline).toBe("Transparent Denim");
    expect(result.attributed_houses).toEqual(["Coperni", "Acne Studios"]);
    expect(result.signal_ids).toHaveLength(1);
  });

  it("defaults attributed_houses and attributed_people to empty arrays", () => {
    const result = trendStorySchema.parse({
      headline: "Minimal Story",
      signal_ids: []
    });
    expect(result.attributed_houses).toEqual([]);
    expect(result.attributed_people).toEqual([]);
    expect(result.signal_ids).toEqual([]);
  });

  it("rejects unknown dominant_type", () => {
    expect(() =>
      trendStorySchema.parse({ headline: "X", dominant_type: "unknown_type" })
    ).toThrow();
  });
});

describe("trendPersonSchema", () => {
  it("parses a person record", () => {
    const result = trendPersonSchema.parse({ name: "Bella Hadid" });
    expect(result.name).toBe("Bella Hadid");
    expect(result.mention_count).toBe(1);
  });
});

describe("STORY_DOMINANT_TYPES", () => {
  it("contains expected values", () => {
    expect(STORY_DOMINANT_TYPES).toContain("garment_moment");
    expect(STORY_DOMINANT_TYPES).toContain("colour_combo");
    expect(STORY_DOMINANT_TYPES).toContain("it_girl_look");
    expect(STORY_DOMINANT_TYPES).toContain("runway_moment");
    expect(STORY_DOMINANT_TYPES).toContain("aesthetic");
  });
});
