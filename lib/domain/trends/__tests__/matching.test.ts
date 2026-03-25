import { describe, it, expect } from "vitest";
import {
  computeUserTrendMatches,
  canonicalizeLabel,
  computeRecencyWeight,
  computeAttributeOverlap
} from "../matching";
import type { TrendSignalWithColour } from "../index";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";

const NOW = new Date().toISOString();
const OLD = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();

function makeSignal(overrides: Partial<TrendSignalWithColour> = {}): TrendSignalWithColour {
  return {
    id: "sig-1",
    trend_type: "colour",
    label: "earthy beige",
    normalized_attributes_json: { family: "beige", undertone: "warm", lightness_band: "high" },
    source_count: 3,
    authority_score: 0.9,
    confidence_score: 0.85,
    last_seen_at: NOW,
    trend_colour: null,
    ...overrides
  };
}

function makeGarment(overrides: Partial<GarmentListItem> = {}): GarmentListItem {
  return {
    id: "g-1",
    user_id: "u-1",
    title: "Beige linen shirt",
    category: "tops",
    subcategory: null,
    pattern: null,
    material: "linen",
    size: null,
    fit: null,
    formality_level: null,
    seasonality: [],
    wardrobe_status: "active",
    purchase_price: null,
    purchase_currency: null,
    purchase_date: null,
    retailer: null,
    favourite_score: null,
    wear_count: 0,
    last_worn_at: null,
    cost_per_wear: null,
    extraction_metadata_json: {},
    created_at: NOW,
    updated_at: NOW,
    images: [],
    preview_url: null,
    recent_wear_events: [],
    primary_colour_family: "beige",
    primary_colour_hex: "#d7c1a1",
    ...overrides
  } as GarmentListItem;
}

describe("canonicalizeLabel", () => {
  it("lowercases, trims, collapses spaces, replaces hyphens", () => {
    expect(canonicalizeLabel("  Wide-Leg Trousers  ")).toBe("wide leg trousers");
    expect(canonicalizeLabel("BUTTER YELLOW")).toBe("butter yellow");
    expect(canonicalizeLabel("over-sized  blazer")).toBe("over sized blazer");
  });
});

describe("computeRecencyWeight", () => {
  it("returns 1.0 for a signal seen today", () => {
    expect(computeRecencyWeight(NOW)).toBeCloseTo(1.0, 1);
  });

  it("returns 0.5 for a signal seen 90+ days ago", () => {
    expect(computeRecencyWeight(OLD)).toBeCloseTo(0.5, 1);
  });

  it("returns 1.0 when last_seen_at is null", () => {
    expect(computeRecencyWeight(null)).toBe(1.0);
  });
});

describe("computeAttributeOverlap", () => {
  it("returns 1.0 when all attributes match", () => {
    const signalAttrs = { category: "tops", fit: "relaxed", material: "linen" };
    const garmentAttrs = { category: "tops", fit: "relaxed", material: "linen" };
    expect(computeAttributeOverlap(signalAttrs, garmentAttrs)).toBe(1.0);
  });

  it("returns 0 when no attributes match", () => {
    const signalAttrs = { category: "trousers", fit: "slim" };
    const garmentAttrs = { category: "tops", fit: "relaxed" };
    expect(computeAttributeOverlap(signalAttrs, garmentAttrs)).toBe(0);
  });

  it("returns 0.5 when half the attributes match", () => {
    const signalAttrs = { category: "tops", fit: "slim" };
    const garmentAttrs = { category: "tops", fit: "relaxed" };
    expect(computeAttributeOverlap(signalAttrs, garmentAttrs)).toBe(0.5);
  });
});

describe("computeUserTrendMatches", () => {
  it("exact_match: colour family matches garment primary_colour_family", () => {
    const signal = makeSignal({
      trend_type: "colour",
      normalized_attributes_json: { family: "beige", undertone: "warm" }
    });
    const garment = makeGarment({ primary_colour_family: "beige" });
    const result = computeUserTrendMatches({
      signals: [signal],
      garments: [garment],
      compatibleColourFamilies: new Map()
    });
    expect(result).toHaveLength(1);
    expect(result[0].match_type).toBe("exact_match");
    expect(result[0].score).toBeGreaterThanOrEqual(0.85);
  });

  it("adjacent_match: garment colour (brown) is in compatible set for beige signal", () => {
    const signal = makeSignal({
      trend_type: "colour",
      normalized_attributes_json: { family: "beige", undertone: "warm" }
    });
    const garment = makeGarment({ primary_colour_family: "brown" });
    const compatibleColourFamilies = new Map([["beige", new Set(["brown"])]]);
    const result = computeUserTrendMatches({
      signals: [signal],
      garments: [garment],
      compatibleColourFamilies
    });
    expect(result).toHaveLength(1);
    expect(result[0].match_type).toBe("adjacent_match");
    expect(result[0].score).toBeGreaterThanOrEqual(0.5);
    expect(result[0].score).toBeLessThan(0.85);
  });

  it("missing_piece: no garment matches colour signal", () => {
    const signal = makeSignal({
      trend_type: "colour",
      normalized_attributes_json: { family: "red" },
      authority_score: 0.9
    });
    const garment = makeGarment({ primary_colour_family: "beige" });
    const result = computeUserTrendMatches({
      signals: [signal],
      garments: [garment],
      compatibleColourFamilies: new Map()
    });
    expect(result).toHaveLength(1);
    expect(result[0].match_type).toBe("missing_piece");
    expect(result[0].score).toBeLessThanOrEqual(0.4);
  });

  it("exact_match: garment category and subcategory match garment-type signal", () => {
    const signal = makeSignal({
      trend_type: "garment",
      label: "wide-leg trousers",
      normalized_attributes_json: { category: "trousers", subcategory: "wide-leg" }
    });
    const garment = makeGarment({
      category: "trousers",
      subcategory: "wide-leg",
      primary_colour_family: "navy"
    });
    const result = computeUserTrendMatches({
      signals: [signal],
      garments: [garment],
      compatibleColourFamilies: new Map()
    });
    expect(result[0].match_type).toBe("exact_match");
  });

  it("adjacent_match: category matches but subcategory differs", () => {
    const signal = makeSignal({
      trend_type: "garment",
      normalized_attributes_json: { category: "trousers", subcategory: "wide-leg" }
    });
    const garment = makeGarment({
      category: "trousers",
      subcategory: "straight-leg",
      primary_colour_family: "black"
    });
    const result = computeUserTrendMatches({
      signals: [signal],
      garments: [garment],
      compatibleColourFamilies: new Map()
    });
    expect(result[0].match_type).toBe("adjacent_match");
  });

  it("styling_match: wardrobe covers all required_categories", () => {
    const signal = makeSignal({
      trend_type: "styling",
      label: "tonal dressing",
      normalized_attributes_json: {
        principle: "tonal_dressing",
        required_categories: ["tops", "trousers"],
        colour_constraint: "monochrome"
      }
    });
    const garments = [
      makeGarment({ id: "g-1", category: "tops", primary_colour_family: "beige" }),
      makeGarment({ id: "g-2", category: "trousers", primary_colour_family: "beige" })
    ];
    const result = computeUserTrendMatches({
      signals: [signal],
      garments,
      compatibleColourFamilies: new Map()
    });
    expect(result[0].match_type).toBe("styling_match");
  });

  it("includes reasoning_json with matched_garment_ids", () => {
    const signal = makeSignal({
      trend_type: "colour",
      normalized_attributes_json: { family: "beige" }
    });
    const garment = makeGarment({ primary_colour_family: "beige" });
    const result = computeUserTrendMatches({
      signals: [signal],
      garments: [garment],
      compatibleColourFamilies: new Map()
    });
    const reasoning = result[0].reasoning_json as { matched_garment_ids: string[] };
    expect(reasoning.matched_garment_ids).toContain("g-1");
  });

  it("filters out non-active garments", () => {
    const signal = makeSignal({ trend_type: "colour", normalized_attributes_json: { family: "beige" } });
    const garment = makeGarment({ wardrobe_status: "archived", primary_colour_family: "beige" });
    const result = computeUserTrendMatches({
      signals: [signal],
      garments: [garment],
      compatibleColourFamilies: new Map()
    });
    expect(result[0].match_type).toBe("missing_piece");
  });
});
