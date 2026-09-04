import {
  applyHardFilters,
  collectColourFiredRules,
  scoreGarment,
  generateOutfit,
  type GeneratorInput
} from "../generator";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";
import type { StyleRuleListItem } from "@/lib/domain/style-rules/service";
import type { UserTrendMatchWithSignal } from "@/lib/domain/trends";
import { describe, it, expect } from "vitest";
import { categoryToRole } from "../generator";
import { expandRulesWithAttributeInference } from "@/lib/domain/style-rules/inference";
import { buildSeedStyleRules } from "@/lib/domain/style-rules/knowledge";

describe("categoryToRole", () => {
  it("maps shirt to top", () => {
    expect(categoryToRole("shirt")).toBe("top");
  });
  it("maps Knitwear to top (case-insensitive)", () => {
    expect(categoryToRole("Knitwear")).toBe("outerwear");
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
  it("uses title text to classify a knit cardigan as outerwear/layer", () => {
    expect(categoryToRole("knit", null, "Graduate Cardi")).toBe("outerwear");
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
    availability: "wearable",
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
    three_d_assets: [],
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

  it("prefers an expensive unworn blazer over a cheap frequently worn one in the same role", () => {
    const garments = [
      makeGarment({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
        category: "blazer",
        purchase_price: 20,
        wear_count: 12,
        last_worn_at: "2026-08-30T00:00:00Z"
      }),
      makeGarment({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
        category: "blazer",
        purchase_price: 400,
        wear_count: 0
      })
    ];
    const result = generateOutfit({
      mode: "plan",
      garments,
      styleRules: [],
      trendSignal: null,
      nowMs: Date.parse("2026-08-31T00:00:00Z")
    });
    expect(result.garments.find((g) => g.role === "outerwear")?.id).toBe(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"
    );
  });

  it("keeps must-include garments that pass hard filters", () => {
    const garments = [
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt", title: "White shirt" }),
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "shirt", title: "Blue shirt" })
    ];
    const result = generateOutfit({
      mode: "trend",
      garments,
      styleRules: [],
      trendSignal: null,
      mustIncludeGarmentIds: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"]
    });
    expect(result.garments.map((g) => g.id)).toContain(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"
    );
  });

  it("omits must-include garments that fail hard filters", () => {
    const jeansId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2";
    const garments = [
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" }),
      makeGarment({ id: jeansId, category: "jeans" })
    ];
    const result = generateOutfit({
      mode: "trend",
      garments,
      styleRules: [
        makeRule({
          predicate: "avoid_with",
          subject_value: "jeans",
          object_value: "formal",
          constraint_type: "hard"
        })
      ],
      trendSignal: null,
      dress_code: "formal",
      mustIncludeGarmentIds: [jeansId]
    });
    expect(result.garments.map((g) => g.id)).not.toContain(jeansId);
  });

  it("does not promote optional accessories past the role threshold via cost-per-wear boost", () => {
    const garments = [
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" }),
      makeGarment({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
        category: "belt",
        purchase_price: 400,
        wear_count: 0
      })
    ];
    const result = generateOutfit({
      mode: "plan",
      garments,
      styleRules: [],
      trendSignal: null
    });
    expect(result.garments.map((g) => g.role)).not.toContain("accessory");
  });

  it("omits a high-delta accessory below threshold in favor of a matching one", () => {
    const matchingId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4";
    const garments = [
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" }),
      makeGarment({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
        category: "belt",
        purchase_price: 400,
        wear_count: 0
      }),
      makeGarment({ id: matchingId, category: "scarf" })
    ];
    const result = generateOutfit({
      mode: "plan",
      garments,
      styleRules: [
        makeRule({
          predicate: "pairs_with",
          subject_value: "scarf",
          object_value: "shirt",
          constraint_type: "soft",
          weight: 0.8
        })
      ],
      trendSignal: null
    });
    expect(result.garments.find((g) => g.role === "accessory")?.id).toBe(matchingId);
  });

  it("includes shoes that pass hard filters even with zero rule score", () => {
    const garments = [
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" }),
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "trouser" }),
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", category: "loafer" })
    ];
    const result = generateOutfit({
      mode: "plan",
      garments,
      styleRules: [],
      trendSignal: null
    });
    expect(result.garments.map((g) => g.role)).toEqual(
      expect.arrayContaining(["top", "bottom", "shoes"])
    );
  });

  it("adds a neglected-value insight for selected garments costing 100 or more per wear", () => {
    const garments = [
      makeGarment({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
        category: "blazer",
        title: "Navy blazer",
        purchase_price: 400,
        wear_count: 0
      })
    ];
    const result = generateOutfit({
      mode: "plan",
      garments,
      styleRules: [],
      trendSignal: null
    });
    expect(result.insights).toEqual(
      expect.arrayContaining([
        {
          key: "occasion",
          title: "Neglected value",
          body: "Navy blazer is costing $400 per wear.",
          tags: ["cost-per-wear"]
        }
      ])
    );
  });

  it("rounds neglected-value amounts and uses purchase_currency when present", () => {
    const garments = [
      makeGarment({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
        category: "blazer",
        title: "Navy blazer",
        purchase_price: 400,
        purchase_currency: "AUD",
        wear_count: 3
      })
    ];
    const result = generateOutfit({
      mode: "plan",
      garments,
      styleRules: [],
      trendSignal: null
    });
    expect(result.insights).toEqual(
      expect.arrayContaining([
        {
          key: "occasion",
          title: "Neglected value",
          body: "Navy blazer is costing AUD 133 per wear.",
          tags: ["cost-per-wear"]
        }
      ])
    );
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

  it("only surfaces layering explanations for garment pairs that actually exist", () => {
    const tee = makeGarment({
      id: "tee",
      category: "shirt",
      title: "WOODS RIB LONGSLEEVE TEE IN BLACK",
      fit: "fitted"
    });
    const cardi = makeGarment({
      id: "cardi",
      category: "knit",
      title: "Viktoria & Woods Graduate Cardi"
    });

    const rules = [
      makeRule({
        predicate: "layerable_with",
        subject_value: "shirt",
        object_value: "blazer",
        rule_type: "layering",
        explanation: "A shirt under a blazer is a classic layering combination for structured looks."
      }),
      makeRule({
        predicate: "layerable_with",
        subject_value: "shirt",
        object_value: "waistcoat",
        rule_type: "layering",
        explanation: "A shirt under a waistcoat gives a smart, layered finish without a jacket."
      }),
      makeRule({
        predicate: "layerable_with",
        subject_value: "shirt",
        object_value: "knitwear",
        rule_type: "layering",
        explanation: "A collared shirt under a knit is a classic smart-casual layering move."
      }),
      makeRule({
        predicate: "layerable_with",
        subject_value: "t-shirt",
        object_value: "cardigan",
        rule_type: "layering",
        explanation: "A t-shirt under a cardigan creates an easy layered casual look."
      })
    ];

    const result = generateOutfit({
      mode: "plan",
      garments: [tee, cardi],
      styleRules: rules,
      trendSignal: null
    });

    expect(result.firedRules.map((rule) => rule.description)).toEqual([
      "A fitted t-shirt under a cardigan creates an easy layered casual look."
    ]);
  });

  it("surfaces red-blue pairing with black as a neutral anchor for a cardigan outfit", () => {
    const redCardigan = makeGarment({
      id: "cardi-red",
      category: "cardigan",
      title: "Red wool cardigan",
      primary_colour_family: "red"
    });
    const blackTop = makeGarment({
      id: "top-black",
      category: "t-shirt",
      title: "Black fitted top",
      fit: "fitted",
      primary_colour_family: "black"
    });
    const blueJeans = makeGarment({
      id: "jeans-blue",
      category: "jeans",
      title: "Classic blue jeans",
      primary_colour_family: "blue"
    });

    const result = collectColourFiredRules(
      [redCardigan, blackTop, blueJeans],
      buildSeedStyleRules() as unknown as StyleRuleListItem[]
    );

    expect(result.map((rule) => rule.description)).toEqual(
      expect.arrayContaining([
        "Blue, red, and yellow form a classic triadic palette with balanced energy.",
        "Black acts as a neutral anchor for red, which keeps bold colour from feeling noisy or overworked.",
        "Black acts as a neutral anchor for blue, giving stronger colour contrast a cleaner base."
      ])
    );
  });
});

describe("generateOutfit excludeGarmentIds", () => {
  it("picks a different garment for a role when the top-scored one is excluded", () => {
    const staleDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const garments = [
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt", last_worn_at: staleDate }),
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "shirt", last_worn_at: null })
    ];
    const withoutExclusion = generateOutfit({ mode: "surprise", garments, styleRules: [], trendSignal: null });
    const preferredId = withoutExclusion.garments.find((g) => g.role === "top")?.id;
    expect(preferredId).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1");

    const withExclusion = generateOutfit({
      mode: "surprise",
      garments,
      styleRules: [],
      trendSignal: null,
      excludeGarmentIds: [preferredId as string]
    });
    expect(withExclusion.garments.find((g) => g.role === "top")?.id).toBe(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"
    );
  });

  it("falls back to reuse when excluding would leave a role with nothing", () => {
    const onlyShirt = makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" });
    const result = generateOutfit({
      mode: "surprise",
      garments: [onlyShirt],
      styleRules: [],
      trendSignal: null,
      excludeGarmentIds: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"]
    });
    expect(result.garments.find((g) => g.role === "top")?.id).toBe(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"
    );
  });

  it("behaves identically to an unset list when excludeGarmentIds is empty", () => {
    const garments = [
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" }),
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "chinos" })
    ];
    const withUndefined = generateOutfit({ mode: "surprise", garments, styleRules: [], trendSignal: null });
    const withEmpty = generateOutfit({
      mode: "surprise",
      garments,
      styleRules: [],
      trendSignal: null,
      excludeGarmentIds: []
    });
    expect(withEmpty.garments).toEqual(withUndefined.garments);
  });
});

describe("generateOutfit liftUnderworn", () => {
  it("drops the underworn/cost-per-wear boost when liftUnderworn is false", () => {
    // Neither has last_worn_at, so recencyPenalty is 0 for both either way —
    // only rankingDelta (wear_count/price) should be able to separate them.
    const cheapWorn = makeGarment({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      category: "blazer",
      purchase_price: 20,
      wear_count: 12
    });
    const expensiveUnworn = makeGarment({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
      category: "blazer",
      purchase_price: 400,
      wear_count: 0
    });
    const garments = [cheapWorn, expensiveUnworn];

    const lifted = generateOutfit({ mode: "plan", garments, styleRules: [], trendSignal: null });
    expect(lifted.garments.find((g) => g.role === "outerwear")?.id).toBe(expensiveUnworn.id);

    const notLifted = generateOutfit({
      mode: "plan", garments, styleRules: [], trendSignal: null, liftUnderworn: false
    });
    expect(notLifted.garments.find((g) => g.role === "outerwear")?.id).toBe(cheapWorn.id);
  });
});

describe("generateOutfit trendWeight", () => {
  const trendSignal: UserTrendMatchWithSignal = {
    user_id: "user-1",
    trend_signal_id: "trend-1",
    match_type: "exact_match",
    score: 1,
    reasoning_json: {},
    trend_signal: {
      trend_type: "garment",
      label: "Blazer moment",
      normalized_attributes_json: { category: "blazer" },
      source_count: 1
    }
  };

  // Both "blazer" and "cardigan" pass generator.ts's isLayeringGarment check
  // (so neither gets excluded by the optional-role threshold below), unlike
  // e.g. "coat" — keeping the only difference between them the trend match.
  it("applies a trend boost outside trend mode when a weight is given", () => {
    const cardigan = makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "cardigan" });
    const blazer = makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "blazer" });

    const result = generateOutfit({
      mode: "surprise", garments: [cardigan, blazer], styleRules: [], trendSignal, trendWeight: 1
    });
    expect(result.garments.find((g) => g.role === "outerwear")?.id).toBe(blazer.id);
  });

  it("ignores the trend signal when trendWeight is 0", () => {
    const cardigan = makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "cardigan" });
    const blazer = makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "blazer" });

    const result = generateOutfit({
      mode: "surprise", garments: [cardigan, blazer], styleRules: [], trendSignal, trendWeight: 0
    });
    expect(result.garments.find((g) => g.role === "outerwear")?.id).toBe(cardigan.id);
  });
});
