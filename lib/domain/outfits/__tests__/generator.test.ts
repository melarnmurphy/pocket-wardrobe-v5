import {
  applyHardFilters,
  scoreGarment,
  generateOutfit,
  type GeneratorInput
} from "../generator";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";
import type { StyleRuleListItem } from "@/lib/domain/style-rules/service";
import { describe, it, expect } from "vitest";
import { categoryToRole } from "../generator";
import { expandRulesWithAttributeInference } from "@/lib/domain/style-rules/inference";

describe("categoryToRole", () => {
  it("maps shirt to top", () => {
    expect(categoryToRole("shirt")).toBe("top");
  });
  it("maps Knitwear to top (case-insensitive)", () => {
    expect(categoryToRole("Knitwear")).toBe("top");
  });
  it("maps trousers to bottom", () => {
    expect(categoryToRole("wide-leg trousers")).toBe("bottom");
  });
  it("maps jeans to bottom", () => {
    expect(categoryToRole("jeans")).toBe("bottom");
  });
  it("maps dress to dress", () => {
    expect(categoryToRole("midi dress")).toBe("dress");
  });
  it("maps coat to outerwear", () => {
    expect(categoryToRole("wool coat")).toBe("outerwear");
  });
  it("maps blazer to outerwear", () => {
    expect(categoryToRole("blazer")).toBe("outerwear");
  });
  it("maps trainers to shoes", () => {
    expect(categoryToRole("trainers")).toBe("shoes");
  });
  it("maps loafers to shoes", () => {
    expect(categoryToRole("white loafers")).toBe("shoes");
  });
  it("maps tote bag to bag", () => {
    expect(categoryToRole("tote bag")).toBe("bag");
  });
  it("maps belt to accessory", () => {
    expect(categoryToRole("belt")).toBe("accessory");
  });
  it("maps earrings to jewellery", () => {
    expect(categoryToRole("gold earrings")).toBe("jewellery");
  });
  it("maps unknown category to other", () => {
    expect(categoryToRole("mystery item")).toBe("other");
  });
});

// Minimal garment fixture helper
function makeGarment(overrides: Partial<GarmentListItem> & { id: string; category: string }): GarmentListItem {
  return {
    user_id: "user-1",
    title: null,
    description: null,
    brand: null,
    subcategory: null,
    pattern: null,
    material: null,
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
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    primary_colour_family: null,
    primary_colour_hex: null,
    preview_url: null,
    images: [],
    recent_wear_events: [],
    ...overrides
  };
}

// Minimal style rule fixture helper
function makeRule(overrides: Partial<StyleRuleListItem> & {
  predicate: string;
  subject_value: string;
  object_value: string;
  constraint_type?: string;
  [key: string]: unknown;
}): StyleRuleListItem {
  return {
    id: "rule-" + Math.random(),
    rule_type: "occasion_fit",
    subject_type: "category",
    object_type: "dress_code",
    weight: 0.8,
    rule_scope: "global",
    user_id: null,
    explanation: "",
    active: true,
    constraint_type: "soft",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides
  } as unknown as StyleRuleListItem;
}

describe("applyHardFilters", () => {
  it("removes garments with avoid_with hard rule matching dress code", () => {
    const jeans = makeGarment({ id: "g1", category: "jeans" });
    const shirt = makeGarment({ id: "g2", category: "shirt" });
    const rule = makeRule({
      predicate: "avoid_with",
      subject_value: "jeans",
      object_value: "formal",
      constraint_type: "hard"
    });
    const result = applyHardFilters([jeans, shirt], [rule], "formal");
    expect(result.map(g => g.id)).toEqual(["g2"]);
  });

  it("does not filter when dress code is undefined", () => {
    const jeans = makeGarment({ id: "g1", category: "jeans" });
    const rule = makeRule({
      predicate: "avoid_with",
      subject_value: "jeans",
      object_value: "formal",
      constraint_type: "hard"
    });
    const result = applyHardFilters([jeans], [rule], undefined);
    expect(result).toHaveLength(1);
  });
});

describe("scoreGarment", () => {
  it("sums weights of firing soft rules for category match", () => {
    const chinos = makeGarment({ id: "g1", category: "chinos" });
    const rule = makeRule({
      predicate: "appropriate_for",
      subject_value: "chinos",
      object_value: "smart_casual",
      weight: 0.9,
      constraint_type: "soft"
    });
    const score = scoreGarment(chinos, [rule], { dress_code: "smart_casual" });
    expect(score).toBeCloseTo(0.9);
  });

  it("ignores hard constraint rules in scoring", () => {
    const jeans = makeGarment({ id: "g1", category: "jeans" });
    const rule = makeRule({
      predicate: "avoid_with",
      subject_value: "jeans",
      object_value: "formal",
      weight: 0.99,
      constraint_type: "hard"
    });
    const score = scoreGarment(jeans, [rule], { dress_code: "formal" });
    expect(score).toBe(0);
  });
});

describe("generateOutfit", () => {
  it("selects a garment for each role with matching garments", () => {
    const garments = [
      makeGarment({ id: "top-1",    category: "shirt" }),
      makeGarment({ id: "bottom-1", category: "chinos" }),
    ];
    const input: GeneratorInput = { mode: "surprise", garments, styleRules: [], trendSignal: null };
    const result = generateOutfit(input);
    const roles = result.garments.map(g => g.role);
    expect(roles).toContain("top");
    expect(roles).toContain("bottom");
  });

  it("applies recency penalty in surprise mode", () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
    const staleDate  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
    const recentShirt = makeGarment({ id: "recent", category: "shirt", last_worn_at: recentDate });
    const staleShirt  = makeGarment({ id: "stale",  category: "shirt", last_worn_at: staleDate });
    const input: GeneratorInput = { mode: "surprise", garments: [recentShirt, staleShirt], styleRules: [], trendSignal: null };
    const result = generateOutfit(input);
    const topGarment = result.garments.find(g => g.role === "top");
    expect(topGarment?.id).toBe("stale");
  });
});

describe("expandRulesWithAttributeInference integration", () => {
  it("garment with layering_piece attribute gets inferred rule boost", () => {
    const tshirt = makeGarment({ id: "tshirt", category: "t-shirt" });
    const attrRule = makeRule({
      predicate: "has_attribute",
      subject_value: "t-shirt",
      object_value: "layering_piece",
      rule_type: "attribute_classification",
      subject_type: "category",
      object_type: "attribute",
      weight: 1.0,
      constraint_type: "soft",
    });
    const outerAttrRule = makeRule({
      predicate: "has_attribute",
      subject_value: "jacket",
      object_value: "outer_layer",
      rule_type: "attribute_classification",
      subject_type: "category",
      object_type: "attribute",
      weight: 1.0,
      constraint_type: "soft",
    });
    // With inference enabled, t-shirt should get a score from inferred layerable_with rule
    const expanded = expandRulesWithAttributeInference([attrRule, outerAttrRule]);
    const score = scoreGarment(tshirt, expanded, {});
    // Inferred rule: t-shirt layerable_with jacket (weight 0.5) → 0.5 * 0.3 = 0.15
    expect(score).toBeGreaterThan(0);
  });

  it("outer layer garment gets object-side boost from layerable_with rule", () => {
    const jacket = makeGarment({ id: "jacket", category: "jacket" });
    const rule = makeRule({
      predicate: "layerable_with",
      subject_value: "t-shirt",
      object_value: "jacket",
      weight: 0.8,
      rule_type: "layering",
      constraint_type: "soft",
    });
    const score = scoreGarment(jacket, [rule], {});
    // jacket is the outer layer (object side): 0.8 * 0.15 = 0.12
    expect(score).toBeCloseTo(0.12);
  });

  it("generateOutfit uses inference-expanded rules without surfacing inferred rules in firedRules", () => {
    const tshirt = makeGarment({ id: "tshirt", category: "t-shirt" });
    const jacket = makeGarment({ id: "jacket", category: "jacket" });
    const attrRule1 = makeRule({
      predicate: "has_attribute",
      subject_value: "t-shirt",
      object_value: "layering_piece",
      rule_type: "attribute_classification",
      subject_type: "category",
      object_type: "attribute",
      weight: 1.0,
      constraint_type: "soft",
    });
    const attrRule2 = makeRule({
      predicate: "has_attribute",
      subject_value: "jacket",
      object_value: "outer_layer",
      rule_type: "attribute_classification",
      subject_type: "category",
      object_type: "attribute",
      weight: 1.0,
      constraint_type: "soft",
    });
    const input: GeneratorInput = {
      mode: "plan",
      garments: [tshirt, jacket],
      styleRules: [attrRule1, attrRule2],
      trendSignal: null,
    };
    const result = generateOutfit(input);
    // Inferred rules should not appear in firedRules
    expect(result.firedRules.every(r => !r.description.includes("inferred"))).toBe(true);
  });
});
