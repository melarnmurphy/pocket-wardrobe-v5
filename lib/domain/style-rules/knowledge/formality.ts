// lib/domain/style-rules/knowledge/formality.ts
import type { SeedStyleRule } from "./index";

type DressCode = "casual" | "smart_casual" | "business_casual" | "formal" | "black_tie";

function hard(
  subject_value: string,
  predicate: "required_for" | "avoid_with",
  dressCodes: DressCode[],
  weight: number,
  explanation: string
): SeedStyleRule[] {
  return dressCodes.map((dc) => ({
    rule_type: "formality",
    subject_type: "category",
    subject_value,
    predicate,
    object_type: "dress_code",
    object_value: dc,
    weight,
    rule_scope: "global" as const,
    explanation,
    constraint_type: "hard" as const,
  }));
}

function soft(
  subject_value: string,
  dressCodes: DressCode[],
  weight: number,
  explanation: string
): SeedStyleRule[] {
  return dressCodes.map((dc) => ({
    rule_type: "formality",
    subject_type: "category",
    subject_value,
    predicate: "appropriate_for",
    object_type: "dress_code",
    object_value: dc,
    weight,
    rule_scope: "global" as const,
    explanation,
    constraint_type: "soft" as const,
  }));
}

export function buildFormalityRules(): SeedStyleRule[] {
  return [
    // Hard rules (8 rows)
    ...hard("suit", "required_for", ["black_tie", "formal"], 0.99, "A suit is a non-negotiable requirement at black tie and formal occasions."),
    ...hard("jeans", "avoid_with", ["black_tie", "formal"], 0.99, "Jeans are too casual and should be avoided at black tie and formal events."),
    ...hard("open-toe shoes", "avoid_with", ["formal"], 0.95, "Open-toe shoes are generally inappropriate for formal occasions."),
    ...hard("trainers", "avoid_with", ["business_casual", "formal", "black_tie"], 0.97, "Trainers are too casual for business-casual settings and above."),
    // Soft rules (10 rows)
    ...soft("loafers", ["smart_casual", "business_casual"], 0.82, "Loafers are a versatile shoe that works well for smart-casual and business-casual dress codes."),
    ...soft("dress shirt", ["business_casual", "formal"], 0.9, "A dress shirt is a reliable choice for business-casual and formal occasions."),
    ...soft("chinos", ["smart_casual", "business_casual"], 0.85, "Chinos sit comfortably in smart-casual and business-casual dress codes."),
    ...soft("polo shirt", ["smart_casual", "casual"], 0.78, "A polo shirt reads polished enough for smart-casual and relaxed enough for casual."),
    ...soft("evening dress", ["formal", "black_tie"], 0.92, "An evening dress is well-suited to formal and black-tie events."),
  ];
}
