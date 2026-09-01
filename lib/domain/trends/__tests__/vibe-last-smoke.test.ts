import { describe, expect, it } from "vitest";
import { enrichRecipePiece, garmentCoversRecipePiece } from "../styling-recipe";
import { computeUserTrendMatches } from "../matching";
import type { TrendSignalWithColour } from "../index";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";

const NOW = new Date().toISOString();

function garment(title: string, category = "shoes", brand?: string) {
  return {
    category,
    title,
    brand: brand ?? null,
    subcategory: null
  };
}

function makeSignal(label: string): TrendSignalWithColour {
  return {
    id: "sig-1",
    trend_type: "garment",
    label,
    normalized_attributes_json: {},
    source_count: 1,
    authority_score: 0.9,
    confidence_score: 0.85,
    last_seen_at: NOW,
    trend_colour: null,
    sources: [],
    entities: [],
    metrics_30d: [],
    latest_metric: null
  };
}

function makeGarment(title: string, category = "shoes"): GarmentListItem {
  return {
    id: "g-1",
    user_id: "u-1",
    title,
    category,
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
    created_at: NOW,
    updated_at: NOW,
    images: [],
    preview_url: null,
    recent_wear_events: [],
    primary_colour_family: null,
    primary_colour_hex: null
  } as GarmentListItem;
}

describe("smoke: vibe vs last vs closure", () => {
  it("does not rewrite skate-inspired into a Vans last", () => {
    const piece = enrichRecipePiece({ piece: "skater-inspired slip-on" });
    expect(piece.piece).toBe("skater-inspired slip-on");
    expect(piece.vibe).toBe("skate");
    expect(piece.closure).toBe("slip_on");
    expect(piece.last).toBeNull();
  });

  it("names lasts when the source names them", () => {
    expect(enrichRecipePiece({ piece: "Onitsuka Tiger Mexico 66" }).last).toBe("runner");
    expect(enrichRecipePiece({ piece: "Puma ballet flats" }).last).toBe("ballet");
    expect(enrichRecipePiece({ piece: "Vans Classic Slip-On" }).last).toBe("vulcanized");
  });

  it("covers skate-inspired slip-on with Vans and Puma ballet, not loafer or laced Onitsuka", () => {
    const signal = enrichRecipePiece({ piece: "skater-inspired slip-on" });
    expect(garmentCoversRecipePiece(garment("Vans Classic Slip-On", "shoes", "Vans"), signal)).toBe(true);
    expect(garmentCoversRecipePiece(garment("Puma ballet flats"), signal)).toBe(true);
    expect(garmentCoversRecipePiece(garment("Black loafers", "loafers"), signal)).toBe(false);
    expect(garmentCoversRecipePiece(garment("Onitsuka Tiger Mexico 66"), signal)).toBe(false);
  });

  it("covers a skate vibe (no slip-on) with Onitsuka, Puma ballet, and Vans", () => {
    const signal = enrichRecipePiece({ piece: "skate-inspired" });
    expect(signal.vibe).toBe("skate");
    expect(signal.closure).toBeNull();
    expect(garmentCoversRecipePiece(garment("Onitsuka Tiger Mexico 66"), signal)).toBe(true);
    expect(garmentCoversRecipePiece(garment("Puma Speedcat"), signal)).toBe(true);
    expect(garmentCoversRecipePiece(garment("Vans Authentic", "shoes", "Vans"), signal)).toBe(true);
    expect(garmentCoversRecipePiece(garment("Black loafers", "loafers"), signal)).toBe(false);
  });

  it("wardrobe matching follows the same matrix", () => {
    const slipOn = makeSignal("skater-inspired slip-on");
    const vibe = makeSignal("skate-inspired");

    expect(
      computeUserTrendMatches({
        signals: [slipOn],
        garments: [makeGarment("Black loafers", "loafers")],
        compatibleColourFamilies: new Map()
      })[0].match_type
    ).toBe("missing_piece");

    expect(
      computeUserTrendMatches({
        signals: [slipOn],
        garments: [makeGarment("Puma ballet flats")],
        compatibleColourFamilies: new Map()
      })[0].match_type
    ).toBe("exact_match");

    expect(
      computeUserTrendMatches({
        signals: [vibe],
        garments: [makeGarment("Onitsuka Tiger Mexico 66")],
        compatibleColourFamilies: new Map()
      })[0].match_type
    ).toBe("exact_match");
  });
});
