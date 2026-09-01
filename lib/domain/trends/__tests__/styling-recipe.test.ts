import { describe, expect, it } from "vitest";
import {
  enrichRecipePiece,
  extractRequiredCategories,
  garmentCoversRecipeCategory,
  mapPieceToCategory,
  normalizeExtractedSignal
} from "../styling-recipe";

describe("styling recipes", () => {
  it("maps cowboy boots to shoes and mini hems to dresses", () => {
    expect(mapPieceToCategory("cowboy boots")).toBe("shoes");
    expect(mapPieceToCategory("mini hem")).toBe("dresses");
    expect(mapPieceToCategory("kick-flare jeans")).toBe("bottoms");
    expect(enrichRecipePiece({ piece: "white plimsolls" }).archetype).toBe("white_plimsoll");
    expect(enrichRecipePiece({ piece: "slim runners" }).archetype).toBe("slim_runner");
    expect(
      garmentCoversRecipeCategory({ category: "trousers" }, "bottoms")
    ).toBe(true);
    expect(
      garmentCoversRecipeCategory({ category: "mini dress" }, "dresses")
    ).toBe(true);
  });

  it("promotes a mini-hem + cowboy-boots claim into a styling recipe", () => {
    const result = normalizeExtractedSignal({
      trend_type: "garment",
      label: "cowboy boots",
      normalized_attributes: {
        anchor: "mini hem",
        counterweight: "cowboy boots"
      } as Record<string, unknown>
    });

    expect(result.trend_type).toBe("styling");
    expect(result.label).toBe("mini hem + cowboy boots");
    expect(result.normalized_attributes.recipe).toBe(true);
    expect(result.normalized_attributes.required_categories).toEqual(["dresses", "shoes"]);
  });

  it("splits a plus-joined label into required wardrobe categories", () => {
    const result = normalizeExtractedSignal({
      trend_type: "garment",
      label: "kick-flare jeans + ballet flats",
      normalized_attributes: {}
    });

    expect(result.trend_type).toBe("styling");
    expect(extractRequiredCategories(result.normalized_attributes)).toEqual([
      "bottoms",
      "shoes"
    ]);
  });
});
