// lib/domain/style-rules/__tests__/schema.test.ts
import { describe, it, expect } from "vitest";
import { styleRuleSchema } from "../index";

describe("styleRuleSchema", () => {
  it("accepts valid constraint_type values", () => {
    const base = {
      rule_type: "test",
      subject_type: "category",
      subject_value: "blazer",
      predicate: "pairs_with",
      object_type: "category",
      object_value: "shirt",
      weight: 0.9,
      rule_scope: "global",
    };
    expect(() => styleRuleSchema.parse({ ...base, constraint_type: "hard" })).not.toThrow();
    expect(() => styleRuleSchema.parse({ ...base, constraint_type: "soft" })).not.toThrow();
  });

  it("rejects invalid constraint_type values", () => {
    const base = {
      rule_type: "test",
      subject_type: "category",
      subject_value: "blazer",
      predicate: "pairs_with",
      object_type: "category",
      object_value: "shirt",
      weight: 0.9,
      rule_scope: "global",
    };
    expect(() => styleRuleSchema.parse({ ...base, constraint_type: "medium" })).toThrow();
  });

  it("defaults constraint_type to 'soft' when absent", () => {
    const result = styleRuleSchema.parse({
      rule_type: "test",
      subject_type: "category",
      subject_value: "blazer",
      predicate: "pairs_with",
      object_type: "category",
      object_value: "shirt",
      weight: 0.9,
      rule_scope: "global",
    });
    expect(result.constraint_type).toBe("soft");
  });
});
