import { describe, expect, it } from "vitest";
import { costPerWearBoost, recencyPenalty, valueNeglect } from "../ranking";

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

describe("costPerWearBoost", () => {
  it("is 0 without a price", () => {
    expect(costPerWearBoost({ purchase_price: null, wear_count: 0 })).toBe(0);
  });

  it("boosts an expensive unworn piece more than a cheap weekly tee", () => {
    const blazer = costPerWearBoost({ purchase_price: 400, wear_count: 0 });
    const tee = costPerWearBoost({ purchase_price: 20, wear_count: 12 });
    expect(blazer).toBeGreaterThan(tee);
    expect(blazer).toBeLessThanOrEqual(1.5);
  });
});

describe("recencyPenalty", () => {
  it("penalizes wears inside 7 days", () => {
    const now = Date.parse("2026-08-31T00:00:00Z");
    expect(recencyPenalty("2026-08-29T00:00:00Z", now)).toBe(0.3);
    expect(recencyPenalty("2026-08-01T00:00:00Z", now)).toBe(0);
  });
});
