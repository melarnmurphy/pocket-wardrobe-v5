import type { StyleRuleListItem } from "@/lib/domain/style-rules/service";

/**
 * Expands a rule set by inferring layerable_with relationships from has_attribute
 * classifications.
 *
 * Chain: A has_attribute layering_piece ∧ B has_attribute outer_layer
 *        → A layerable_with B (weight 0.5, inferred baseline)
 *
 * Rules:
 * - Explicit layerable_with rules are never replaced — inference only fills gaps
 * - Self-loops are skipped (knitwear is both; knitwear→knitwear is never inferred)
 * - Inactive has_attribute rules are ignored
 */
export function expandRulesWithAttributeInference(
  rules: StyleRuleListItem[]
): StyleRuleListItem[] {
  const active = rules.filter(r => r.active);

  const layeringPieces = new Set<string>();
  const outerLayers = new Set<string>();

  for (const r of active) {
    if (r.predicate !== "has_attribute") continue;
    if (r.object_value === "layering_piece") layeringPieces.add(r.subject_value.toLowerCase());
    if (r.object_value === "outer_layer") outerLayers.add(r.subject_value.toLowerCase());
  }

  const explicitPairs = new Set<string>(
    rules
      .filter(r => r.predicate === "layerable_with")
      .map(r => `${r.subject_value.toLowerCase()}:${r.object_value.toLowerCase()}`)
  );

  const inferred: StyleRuleListItem[] = [];

  for (const piece of layeringPieces) {
    for (const outer of outerLayers) {
      if (piece === outer) continue;
      if (explicitPairs.has(`${piece}:${outer}`)) continue;

      inferred.push({
        id: `inferred:${piece}:layerable_with:${outer}`,
        rule_type: "layering",
        subject_type: "category",
        subject_value: piece,
        predicate: "layerable_with",
        object_type: "category",
        object_value: outer,
        weight: 0.5,
        rule_scope: "global",
        user_id: null,
        explanation: `${piece} (layering piece) can be worn under ${outer} (outer layer) — inferred from attribute classifications`,
        active: true,
        constraint_type: "soft",
        created_at: new Date().toISOString(),
      } as StyleRuleListItem);
    }
  }

  return [...rules, ...inferred];
}
