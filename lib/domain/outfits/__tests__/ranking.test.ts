import { describe, expect, it } from "vitest";
import { compareNeglected, rankingDelta, recencyPenalty, valueNeglect } from "../ranking";

describe("valueNeglect", () => {
  it("is null when price is missing", () => {
    expect(valueNeglect({ purchase_price: null, wear_count: 0 })).toBeNull();
  });

  it("is purchase_price when never worn", () => {
    expect(valueNeglect({ purchase_price: 400, wear_count: 0 })).toBe(400);
  });

  it("divides by wear_count once worn", () => {
    expect(valueNeglect({ purchase_price: 400, wear_count: 4 })).toBe(100);
  });
});

describe("rankingDelta", () => {
  it("rotates never-worn unpriced items", () => {
    expect(rankingDelta({ purchase_price: null, wear_count: 0 })).toBeGreaterThan(0);
  });

  it("ranks never-worn 400 above never-worn 40", () => {
    const expensive = rankingDelta({ purchase_price: 400, wear_count: 0 });
    const cheap = rankingDelta({ purchase_price: 40, wear_count: 0 });
    expect(expensive).toBeGreaterThan(cheap);
    expect(expensive).toBeLessThanOrEqual(1.2);
  });

  it("lets never-worn 40 beat 400 worn 20 times", () => {
    const unusedCheap = rankingDelta({ purchase_price: 40, wear_count: 0 });
    const overwornLuxury = rankingDelta({ purchase_price: 400, wear_count: 20 });
    expect(unusedCheap).toBeGreaterThan(overwornLuxury);
  });
});

describe("recencyPenalty", () => {
  it("penalizes wears inside 7 days", () => {
    const now = Date.parse("2026-08-31T00:00:00Z");
    expect(recencyPenalty("2026-08-29T00:00:00Z", now)).toBe(0.3);
    expect(recencyPenalty("2026-08-01T00:00:00Z", now)).toBe(0);
  });
});

describe("compareNeglected", () => {
  it("sorts neglected priced items above unpriced", () => {
    const priced = { purchase_price: 400, wear_count: 0 };
    const unpriced = { purchase_price: null, wear_count: 0 };
    expect(compareNeglected(priced, unpriced)).toBeLessThan(0);
  });

  it("sorts higher neglect value first", () => {
    const expensive = { purchase_price: 400, wear_count: 0 };
    const cheap = { purchase_price: 20, wear_count: 0 };
    expect(compareNeglected(expensive, cheap)).toBeLessThan(0);
  });

  it("returns 0 when both lack a price", () => {
    const left = { purchase_price: null, wear_count: 2 };
    const right = { purchase_price: null, wear_count: 5 };
    expect(compareNeglected(left, right)).toBe(0);
  });
});
