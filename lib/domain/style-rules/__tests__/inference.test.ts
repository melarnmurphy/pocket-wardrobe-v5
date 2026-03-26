import { describe, it, expect } from "vitest";
import { expandRulesWithAttributeInference } from "@/lib/domain/style-rules/inference";
import type { StyleRuleListItem } from "@/lib/domain/style-rules/service";

function attrRule(category: string, attribute: string): StyleRuleListItem {
  return {
    id: `attr:${category}:${attribute}`,
    rule_type: "attribute_classification",
    subject_type: "category",
    subject_value: category,
    predicate: "has_attribute",
    object_type: "attribute",
    object_value: attribute,
    weight: 1.0,
    rule_scope: "global",
    user_id: null,
    explanation: null,
    active: true,
    constraint_type: "soft",
    created_at: "2026-01-01T00:00:00Z",
  } as StyleRuleListItem;
}

function layerRule(subject: string, object: string, weight = 0.9): StyleRuleListItem {
  return {
    id: `layer:${subject}:${object}`,
    rule_type: "layering",
    subject_type: "category",
    subject_value: subject,
    predicate: "layerable_with",
    object_type: "category",
    object_value: object,
    weight,
    rule_scope: "global",
    user_id: null,
    explanation: null,
    active: true,
    constraint_type: "soft",
    created_at: "2026-01-01T00:00:00Z",
  } as StyleRuleListItem;
}

describe("expandRulesWithAttributeInference", () => {
  it("infers layerable_with from has_attribute classifications", () => {
    const rules = [
      attrRule("t-shirt", "layering_piece"),
      attrRule("jacket", "outer_layer"),
    ];
    const expanded = expandRulesWithAttributeInference(rules);
    const inferred = expanded.filter(r => r.id.startsWith("inferred:"));
    expect(inferred).toHaveLength(1);
    expect(inferred[0].subject_value).toBe("t-shirt");
    expect(inferred[0].object_value).toBe("jacket");
    expect(inferred[0].predicate).toBe("layerable_with");
    expect(inferred[0].weight).toBe(0.5);
  });

  it("does not infer where an explicit rule already exists", () => {
    const rules = [
      attrRule("t-shirt", "layering_piece"),
      attrRule("jacket", "outer_layer"),
      layerRule("t-shirt", "jacket", 0.82),
    ];
    const expanded = expandRulesWithAttributeInference(rules);
    const inferred = expanded.filter(r => r.id.startsWith("inferred:"));
    expect(inferred).toHaveLength(0);
  });

  it("skips self-loops for dual-category items (knitwear)", () => {
    const rules = [
      attrRule("knitwear", "layering_piece"),
      attrRule("knitwear", "outer_layer"),
    ];
    const expanded = expandRulesWithAttributeInference(rules);
    const inferred = expanded.filter(r => r.id.startsWith("inferred:"));
    expect(inferred.every(r => !(r.subject_value === "knitwear" && r.object_value === "knitwear"))).toBe(true);
  });

  it("preserves all original rules", () => {
    const rules = [
      attrRule("t-shirt", "layering_piece"),
      attrRule("jacket", "outer_layer"),
    ];
    const expanded = expandRulesWithAttributeInference(rules);
    expect(expanded.filter(r => !r.id.startsWith("inferred:"))).toHaveLength(2);
  });

  it("infers all N×M combinations minus explicit and self-loops", () => {
    const rules = [
      attrRule("t-shirt", "layering_piece"),
      attrRule("shirt", "layering_piece"),
      attrRule("jacket", "outer_layer"),
      attrRule("blazer", "outer_layer"),
      layerRule("shirt", "blazer"), // explicit — should not be inferred
    ];
    const expanded = expandRulesWithAttributeInference(rules);
    const inferred = expanded.filter(r => r.id.startsWith("inferred:"));
    // t-shirt+jacket, t-shirt+blazer, shirt+jacket = 3 (shirt+blazer is explicit)
    expect(inferred).toHaveLength(3);
  });

  it("ignores inactive has_attribute rules", () => {
    const inactive = { ...attrRule("t-shirt", "layering_piece"), active: false };
    const rules = [inactive, attrRule("jacket", "outer_layer")];
    const expanded = expandRulesWithAttributeInference(rules);
    const inferred = expanded.filter(r => r.id.startsWith("inferred:"));
    expect(inferred).toHaveLength(0);
  });

  it("inferred rules have weight 0.5", () => {
    const rules = [
      attrRule("tank", "layering_piece"),
      attrRule("coat", "outer_layer"),
    ];
    const expanded = expandRulesWithAttributeInference(rules);
    const inferred = expanded.filter(r => r.id.startsWith("inferred:"));
    expect(inferred[0].weight).toBe(0.5);
  });
});
