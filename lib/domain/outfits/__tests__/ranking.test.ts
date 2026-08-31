import { describe, expect, it } from "vitest";
import * as ranking from "../ranking";
import { rankingDelta, recencyPenalty } from "../ranking";

describe("ranking module boundary", () => {
  it("does not export closet-sort helpers used by the client", () => {
    expect("compareNeglected" in ranking).toBe(false);
    expect("valueNeglect" in ranking).toBe(false);
  });
});

describe("rankingDelta", () => {
  it("rotates never-worn unpriced items", () => {
    const unused = rankingDelta({ purchase_price: null, wear_count: 0 });
    expect(unused).toBeGreaterThan(0);
    expect(unused).toBeCloseTo(0.3544, 4);
  });

  it("ranks never-worn 400 above never-worn 40", () => {
    const expensive = rankingDelta({ purchase_price: 400, wear_count: 0 });
    const cheap = rankingDelta({ purchase_price: 40, wear_count: 0 });
    expect(expensive).toBeGreaterThan(cheap);
    expect(expensive).toBeLessThanOrEqual(1.2);
    expect(cheap).toBeCloseTo(0.8417, 4);
    expect(expensive).toBeCloseTo(0.9711, 4);
  });

  it("lets never-worn 40 beat 400 worn 20 times", () => {
    const unusedCheap = rankingDelta({ purchase_price: 40, wear_count: 0 });
    const overwornLuxury = rankingDelta({ purchase_price: 400, wear_count: 20 });
    expect(unusedCheap).toBeGreaterThan(overwornLuxury);
    expect(overwornLuxury).toBeCloseTo(0.5461, 4);
  });
});

describe("recencyPenalty", () => {
  it("penalizes wears inside 7 days", () => {
    const now = Date.parse("2026-08-31T00:00:00Z");
    expect(recencyPenalty("2026-08-29T00:00:00Z", now)).toBe(0.3);
    expect(recencyPenalty("2026-08-01T00:00:00Z", now)).toBe(0);
  });
});
