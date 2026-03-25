import { describe, it, expect } from "vitest";
import { extractSeasonFromText, inferSeasonFromDate, resolveSeasonYear } from "../seasons";

describe("extractSeasonFromText", () => {
  it("extracts SS shorthand", () => {
    expect(extractSeasonFromText("The SS26 collections were bold")?.season).toBe("SS26");
  });
  it("extracts AW shorthand", () => {
    expect(extractSeasonFromText("AW25 is all about quiet luxury")?.season).toBe("AW25");
  });
  it("maps FW to AW", () => {
    expect(extractSeasonFromText("FW26 runways")?.season).toBe("AW26");
  });
  it("extracts Spring/Summer long form", () => {
    const r = extractSeasonFromText("Spring/Summer 2027 key pieces");
    expect(r?.season).toBe("SS27");
    expect(r?.year).toBe(2027);
  });
  it("extracts Fall/Winter long form", () => {
    expect(extractSeasonFromText("Fall/Winter 2026 collections")?.season).toBe("AW26");
  });
  it("extracts Autumn/Winter long form", () => {
    expect(extractSeasonFromText("Autumn/Winter 2025")?.season).toBe("AW25");
  });
  it("extracts single word Spring", () => {
    expect(extractSeasonFromText("Spring 2026 trend report")?.season).toBe("SS26");
  });
  it("returns null when no season present", () => {
    expect(extractSeasonFromText("Jennifer Lopez wore a pencil skirt")).toBeNull();
  });
});

describe("inferSeasonFromDate", () => {
  it("Jan → SS same year", () => {
    const r = inferSeasonFromDate("2027-01-15");
    expect(r?.season).toBe("SS27");
    expect(r?.year).toBe(2027);
  });
  it("Jun → SS same year", () => {
    expect(inferSeasonFromDate("2027-06-30")?.season).toBe("SS27");
  });
  it("Jul → AW same year", () => {
    expect(inferSeasonFromDate("2027-07-01")?.season).toBe("AW27");
  });
  it("Dec → AW same year", () => {
    expect(inferSeasonFromDate("2027-12-31")?.season).toBe("AW27");
  });
  it("returns null for null input", () => {
    expect(inferSeasonFromDate(null)).toBeNull();
  });
});

describe("resolveSeasonYear", () => {
  it("explicit text beats date inference", () => {
    // Article published in Jan (would infer SS27) but explicitly says AW26
    const r = resolveSeasonYear("AW26 runway recap", "2027-01-20");
    expect(r?.season).toBe("AW26");
  });
  it("falls back to date when no explicit season", () => {
    const r = resolveSeasonYear("Jennifer Lopez wore a pencil skirt", "2027-09-10");
    expect(r?.season).toBe("AW27");
  });
  it("returns null when no text season and no publish date", () => {
    expect(resolveSeasonYear("no season here", null)).toBeNull();
  });
});
