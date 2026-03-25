// lib/domain/style-rules/__tests__/knowledge.test.ts
import { describe, it, expect } from "vitest";
import { buildSeedStyleRules } from "../knowledge/index";

describe("buildSeedStyleRules", () => {
  it("returns an array of rules", () => {
    const rules = buildSeedStyleRules();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });

  it("produces at least 100 rules", () => {
    const rules = buildSeedStyleRules();
    expect(rules.length).toBeGreaterThanOrEqual(100);
  });

  it("every rule has required fields with non-empty strings", () => {
    const rules = buildSeedStyleRules();
    for (const rule of rules) {
      expect(rule.rule_type.length).toBeGreaterThan(0);
      expect(rule.subject_type.length).toBeGreaterThan(0);
      expect(rule.subject_value.length).toBeGreaterThan(0);
      expect(rule.predicate.length).toBeGreaterThan(0);
      expect(rule.object_type.length).toBeGreaterThan(0);
      expect(rule.object_value.length).toBeGreaterThan(0);
      expect(rule.explanation.length).toBeGreaterThan(0);
      expect(rule.rule_scope).toBe("global");
    }
  });

  it("all weights are on the 0-1 scale", () => {
    const rules = buildSeedStyleRules();
    for (const rule of rules) {
      expect(rule.weight).toBeGreaterThan(0);
      expect(rule.weight).toBeLessThanOrEqual(1);
    }
  });

  it("every rule has constraint_type of 'hard' or 'soft'", () => {
    const rules = buildSeedStyleRules();
    for (const rule of rules) {
      expect(["hard", "soft"]).toContain(rule.constraint_type);
    }
  });

  it("hard rules only use required_for or avoid_with predicates", () => {
    const rules = buildSeedStyleRules();
    const hardRules = rules.filter((r) => r.constraint_type === "hard");
    expect(hardRules.length).toBeGreaterThan(0);
    for (const rule of hardRules) {
      expect(["required_for", "avoid_with"]).toContain(rule.predicate);
    }
  });

  it("soft formality rules do not use required_for or avoid_with predicates", () => {
    // Note: avoid_with is valid for soft rules in other contexts (e.g. weather_fit).
    // Only formality rules use hard constraint_type — this test validates that boundary.
    const rules = buildSeedStyleRules();
    const softFormality = rules.filter(
      (r) => r.constraint_type === "soft" && r.rule_type === "formality"
    );
    for (const rule of softFormality) {
      expect(rule.predicate).not.toBe("required_for");
      expect(rule.predicate).not.toBe("avoid_with");
    }
  });

  it("seasonality rules have atomic object_value (no commas)", () => {
    const rules = buildSeedStyleRules();
    const seasonalityRules = rules.filter((r) => r.rule_type === "seasonality");
    expect(seasonalityRules.length).toBeGreaterThan(0);
    for (const rule of seasonalityRules) {
      expect(rule.object_value).not.toContain(",");
      expect(["spring", "summer", "autumn", "winter"]).toContain(rule.object_value);
    }
  });

  it("produces exactly 15 seasonality rules", () => {
    const rules = buildSeedStyleRules();
    const seasonalityRules = rules.filter((r) => r.rule_type === "seasonality");
    expect(seasonalityRules.length).toBe(15);
  });

  it("produces 32 colour rules (complement + analogous + triadic)", () => {
    const rules = buildSeedStyleRules();
    const colourRules = rules.filter((r) =>
      ["colour_complement", "colour_analogous", "colour_triadic"].includes(r.rule_type)
    );
    expect(colourRules.length).toBe(32);
  });

  it("formality hard rules target dress_code object type", () => {
    const rules = buildSeedStyleRules();
    const hardRules = rules.filter((r) => r.constraint_type === "hard");
    for (const rule of hardRules) {
      expect(rule.object_type).toBe("dress_code");
    }
  });

  it("dress_code values use snake_case (no hyphens)", () => {
    const rules = buildSeedStyleRules();
    const dressCodes = rules.filter((r) => r.object_type === "dress_code");
    for (const rule of dressCodes) {
      expect(rule.object_value).not.toContain("-");
    }
  });

  it("no two global rules share the same (rule_type, subject_type, subject_value, predicate, object_type, object_value) tuple", () => {
    const rules = buildSeedStyleRules();
    const keys = rules.map(
      (r) =>
        `${r.rule_type}|${r.subject_type}|${r.subject_value}|${r.predicate}|${r.object_type}|${r.object_value}`
    );
    const unique = new Set(keys);
    expect(unique.size).toBe(rules.length);
  });
});
