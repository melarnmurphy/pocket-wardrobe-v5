import { describe, it, expect } from "vitest";
import { trendStorySchema, trendPersonSchema, STORY_DOMINANT_TYPES } from "../index";
import { SCANNERS, SCANNER_BY_ARCHETYPE } from "../prompts/grounding-prompts";

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

describe("new scanner archetypes", () => {
  it("includes design_house, fashion_week, it_girl_discovery in SCANNERS", () => {
    const archetypes = SCANNERS.map((s) => s.archetype);
    expect(archetypes).toContain("design_house");
    expect(archetypes).toContain("fashion_week");
    expect(archetypes).toContain("it_girl_discovery");
  });

  it("SCANNER_BY_ARCHETYPE has entries for new archetypes", () => {
    expect(SCANNER_BY_ARCHETYPE["design_house"]).toBeDefined();
    expect(SCANNER_BY_ARCHETYPE["fashion_week"]).toBeDefined();
    expect(SCANNER_BY_ARCHETYPE["it_girl_discovery"]).toBeDefined();
  });

  it("design_house scanner builds a query mentioning design house", () => {
    const scanner = SCANNER_BY_ARCHETYPE["design_house"];
    const query = scanner.buildGroundingQuery({ now: "2026-04-26T00:00:00Z" });
    expect(query.toLowerCase()).toMatch(/design house|fashion house|collection/);
  });

  it("it_girl_discovery scanner builds a query mentioning style or best dressed", () => {
    const scanner = SCANNER_BY_ARCHETYPE["it_girl_discovery"];
    const query = scanner.buildGroundingQuery({ now: "2026-04-26T00:00:00Z" });
    expect(query.toLowerCase()).toMatch(/best dressed|it girl|style icon|street style/);
  });
});

import { buildExtractionPrompt } from "../extraction";

describe("buildExtractionPrompt with scanner archetype", () => {
  it("includes house attribution instructions for design_house scanner", () => {
    const prompt = buildExtractionPrompt(
      {
        title: "Prada SS26 Collection Review",
        excerpt: "Prada showed transparent organza with structural jackets.",
        author: null,
        publishDate: null,
        sourceName: "vogue.com"
      },
      "design_house"
    );
    expect(prompt).toContain("house_attribution");
  });

  it("includes person attribution instructions for it_girl_discovery scanner", () => {
    const prompt = buildExtractionPrompt(
      {
        title: "Best Dressed This Week",
        excerpt: "Kendall Jenner stepped out in a trench coat and ballet flats.",
        author: null,
        publishDate: null,
        sourceName: "harpersbazaar.com"
      },
      "it_girl_discovery"
    );
    expect(prompt).toContain("person_attribution");
  });

  it("does not include attribution fields for editorial scanner", () => {
    const prompt = buildExtractionPrompt(
      {
        title: "Spring Trends",
        excerpt: "Quiet luxury continues to dominate.",
        author: null,
        publishDate: null,
        sourceName: "vogue.com"
      },
      "editorial"
    );
    expect(prompt).not.toContain("house_attribution");
  });
});
