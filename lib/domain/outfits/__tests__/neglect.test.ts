import { describe, expect, it } from "vitest";
import { compareNeglected, valueNeglect } from "../neglect";

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
