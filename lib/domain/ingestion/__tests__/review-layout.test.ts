import { describe, expect, it } from "vitest";
import { calculateReviewLayout } from "../review-layout";

describe("calculateReviewLayout", () => {
  it("centres a single detected piece", () => {
    const [piece] = calculateReviewLayout([{ aspectRatio: 0.6 }]);
    expect(piece.left).toBeGreaterThan(35);
    expect(piece.left).toBeLessThan(50);
    expect(piece.top).toBeGreaterThan(0);
  });

  it("distributes pieces evenly and keeps them inside the surface", () => {
    const pieces = calculateReviewLayout([
      { aspectRatio: 0.5 }, { aspectRatio: 1.8 }, { aspectRatio: 0.7 },
      { aspectRatio: 0.4 }, { aspectRatio: 0.8 }, { aspectRatio: 1.2 }, { aspectRatio: 0.6 }
    ]);
    expect(pieces).toHaveLength(7);
    expect(pieces.every((piece) => piece.left >= 0 && piece.top >= 0 && piece.left + piece.width <= 100 && piece.top + piece.height <= 100)).toBe(true);
    expect(pieces[0].left).toBeLessThan(pieces[1].left);
    expect(pieces[1].left).toBeLessThan(pieces[2].left);
    expect(pieces[4].top).toBeGreaterThan(pieces[0].top);
  });

  it("keeps pending placeholders quieter than resolved pieces", () => {
    const pieces = calculateReviewLayout([{ aspectRatio: 0.7 }, { pending: true }]);
    expect(pieces[1].height).toBeLessThan(pieces[0].height);
  });
});
