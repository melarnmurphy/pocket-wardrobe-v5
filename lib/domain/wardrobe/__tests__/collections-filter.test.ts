import { describe, it, expect } from "vitest";
import { garmentInCollection } from "@/lib/domain/wardrobe/collections-filter";

describe("garmentInCollection", () => {
  const collections = [
    { id: "col-1", garmentIds: ["g1", "g2"] },
    { id: "col-2", garmentIds: [] }
  ];

  it("returns true when the garment id is in the collection's garmentIds", () => {
    expect(garmentInCollection("g1", "col-1", collections)).toBe(true);
  });

  it("returns false when the garment id is not in the collection's garmentIds", () => {
    expect(garmentInCollection("g3", "col-1", collections)).toBe(false);
  });

  it("returns false for an empty collection", () => {
    expect(garmentInCollection("g1", "col-2", collections)).toBe(false);
  });

  it("returns false when the collection id does not exist", () => {
    expect(garmentInCollection("g1", "missing-id", collections)).toBe(false);
  });
});
