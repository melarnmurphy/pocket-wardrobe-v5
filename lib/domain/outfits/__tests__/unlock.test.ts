import { describe, it, expect } from "vitest";
import { countRoleCompleteCombos, scoreUnlockCandidates } from "../unlock";
import { isRoleCompleteOutfit } from "../role-complete";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";

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
    three_d_assets: [],
    recent_wear_events: [],
    ...overrides
  };
}

describe("isRoleCompleteOutfit", () => {
  it("accepts dress+shoes or top+bottom+shoes, not two arbitrary pieces", () => {
    expect(
      isRoleCompleteOutfit([
        { role: "top" },
        { role: "bottom" }
      ])
    ).toBe(false);
    expect(
      isRoleCompleteOutfit([
        { role: "dress" },
        { role: "shoes" }
      ])
    ).toBe(true);
    expect(
      isRoleCompleteOutfit([
        { role: "top" },
        { role: "bottom" },
        { role: "shoes" }
      ])
    ).toBe(true);
  });
});

describe("countRoleCompleteCombos", () => {
  it("counts zero combos without a complete set", () => {
    expect(
      countRoleCompleteCombos(
        [makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" })],
        []
      )
    ).toBe(0);
  });

  it("counts dress+shoes and top+bottom+shoes", () => {
    const wardrobe = [
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" }),
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "trouser" }),
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", category: "loafer" }),
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4", category: "midi dress" })
    ];
    expect(countRoleCompleteCombos(wardrobe, [])).toBe(2);
  });
});

describe("scoreUnlockCandidates", () => {
  it("scores a missing bottom that pairs with existing tops and shoes", () => {
    const wardrobe = [
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" }),
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "loafer" })
    ];
    const scores = scoreUnlockCandidates(wardrobe, [], [
      {
        id: "cand-1",
        label: "Navy trousers",
        source: "trend",
        synthetic: {
          id: "synthetic-1",
          title: "Navy trousers",
          category: "trouser",
          subcategory: null,
          primary_colour_family: "navy"
        }
      }
    ]);
    expect(scores[0]?.unlock_count).toBeGreaterThanOrEqual(1);
    expect(scores[0]?.reasoning).toContain("trouser");
    expect(scores[0]?.reasoning).toBe("Adds 1 outfit by filling trouser.");
  });

  it("returns only positive unlocks, sorted desc, sliced to 3", () => {
    const wardrobe = [
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" }),
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "shirt", title: "Tee two" }),
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", category: "loafer" })
    ];
    const scores = scoreUnlockCandidates(wardrobe, [], [
      {
        id: "zero",
        label: "Another shirt",
        source: "lookbook",
        synthetic: {
          id: "synthetic-shirt",
          title: "Another shirt",
          category: "shirt",
          subcategory: null,
          primary_colour_family: null
        }
      },
      {
        id: "bottom-a",
        label: "Trousers",
        source: "trend",
        synthetic: {
          id: "synthetic-bottom",
          title: "Trousers",
          category: "trouser",
          subcategory: null,
          primary_colour_family: "navy"
        }
      },
      {
        id: "dress-a",
        label: "Dress",
        source: "lookbook",
        synthetic: {
          id: "synthetic-dress",
          title: "Dress",
          category: "midi dress",
          subcategory: null,
          primary_colour_family: "black"
        }
      },
      {
        id: "bottom-b",
        label: "Jeans",
        source: "trend",
        synthetic: {
          id: "synthetic-jeans",
          title: "Jeans",
          category: "jeans",
          subcategory: null,
          primary_colour_family: "blue"
        }
      },
      {
        id: "skirt-a",
        label: "Skirt",
        source: "trend",
        synthetic: {
          id: "synthetic-skirt",
          title: "Skirt",
          category: "skirt",
          subcategory: null,
          primary_colour_family: "black"
        }
      }
    ]);
    expect(scores).toHaveLength(3);
    expect(scores.every((s) => s.unlock_count > 0)).toBe(true);
    expect(scores.map((s) => s.unlock_count)).toEqual(
      [...scores.map((s) => s.unlock_count)].sort((a, b) => b - a)
    );
    expect(scores.some((s) => s.id === "zero")).toBe(false);
  });
});
