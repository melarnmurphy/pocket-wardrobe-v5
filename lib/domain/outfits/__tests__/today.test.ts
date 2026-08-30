import { describe, it, expect } from "vitest";
import { suggestTodayOutfit } from "../today";
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

describe("suggestTodayOutfit", () => {
  it("returns a plan-mode outfit using weather context", () => {
    const result = suggestTodayOutfit({
      garments: [
        makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" }),
        makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "trouser" }),
        makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", category: "loafer" })
      ],
      styleRules: [],
      weather: "mild_clear"
    });
    expect(result.garments.length).toBeGreaterThanOrEqual(2);
  });

  it("suppresses garments from recent saved outfits", () => {
    const shirtA = makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt", title: "A" });
    const shirtB = makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "shirt", title: "B", purchase_price: 10, wear_count: 0 });
    const result = suggestTodayOutfit({
      garments: [shirtA, shirtB, makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", category: "trouser" })],
      styleRules: [],
      recentOutfitGarmentIds: [shirtA.id as string],
      nowMs: Date.parse("2026-08-31T00:00:00Z")
    });
    expect(result.garments.find((g) => g.role === "top")?.id).toBe(shirtB.id);
  });
});
