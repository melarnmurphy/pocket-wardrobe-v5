import { describe, expect, it } from "vitest";
import { chipsFromOutfit } from "@/components/reason-strip";

describe("chipsFromOutfit", () => {
  it("returns at most three chips and prefers weather then a fired rule", () => {
    const chips = chipsFromOutfit(
      {
        garments: [],
        firedRules: [{ description: "Navy pairs with beige", garment_ids: [] }],
        insights: [{ key: "weather", title: "Mild clear", body: "", tags: [] }],
        explanation: null
      },
      ["Unworn blazer"]
    );
    expect(chips.map((c) => c.label)).toEqual([
      "Mild clear",
      "Navy pairs with beige",
      "Unworn blazer"
    ]);
  });
});
