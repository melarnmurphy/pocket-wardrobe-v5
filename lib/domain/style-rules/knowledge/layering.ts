// lib/domain/style-rules/knowledge/layering.ts
import type { SeedStyleRule } from "./index";

function layer(subject: string, object: string, weight: number, explanation: string): SeedStyleRule {
  return {
    rule_type: "layering",
    subject_type: "category",
    subject_value: subject,
    predicate: "layerable_with",
    object_type: "category",
    object_value: object,
    weight,
    rule_scope: "global",
    explanation,
    constraint_type: "soft",
  };
}

function attr(category: string, attribute: "layering_piece" | "outer_layer", explanation: string): SeedStyleRule {
  return {
    rule_type: "attribute_classification",
    subject_type: "category",
    subject_value: category,
    predicate: "has_attribute",
    object_type: "attribute",
    object_value: attribute,
    weight: 1.0,
    rule_scope: "global",
    explanation,
    constraint_type: "soft",
  };
}

export function buildLayeringRules(): SeedStyleRule[] {
  return [
    // COMBINATION RULES — specific category pairings with base weights
    layer("knitwear", "coat", 0.9, "Knitwear often layers well with coats in cooler weather."),
    layer("shirt", "blazer", 0.92, "A shirt under a blazer is a classic layering combination for structured looks."),
    layer("t-shirt", "cardigan", 0.85, "A t-shirt under a cardigan creates an easy layered casual look."),
    layer("turtleneck", "coat", 0.88, "A turtleneck under a coat adds warmth and a strong visual layer in cold weather."),
    layer("shirt", "waistcoat", 0.84, "A shirt under a waistcoat gives a smart, layered finish without a jacket."),
    layer("base-layer", "puffer", 0.93, "A base layer under a puffer is the most practical winter layering combination."),
    layer("tank", "shirt", 0.78, "A tank under an open shirt creates an effortless layered look."),
    layer("dress", "denim jacket", 0.8, "A dress with a denim jacket over it adds casual contrast and warmth."),
    layer("bodysuit", "trousers", 0.82, "A bodysuit tucked into trousers gives a clean, smooth layered silhouette."),
    layer("shirt", "knitwear", 0.86, "A collared shirt under a knit is a classic smart-casual layering move."),
    layer("t-shirt", "jacket", 0.82, "A t-shirt under a jacket is an effortlessly casual layering combination."),
    layer("vest", "blazer", 0.83, "A vest under a blazer adds texture and depth to a tailored look."),
    layer("turtleneck", "blazer", 0.87, "A turtleneck under a blazer creates a sleek modern alternative to a shirt and tie."),

    // ATTRIBUTE CLASSIFICATIONS — factual declarations of what each category is.
    // These are the building blocks for user-defined rules and future multi-hop inference:
    // e.g. a user can write their own rule "layering_piece works_with outer_layer" at
    // whatever weight reflects their personal style, without us imposing an opinion.

    // Things that go underneath
    attr("t-shirt",    "layering_piece", "A t-shirt is a base layer that sits under outer layers."),
    attr("shirt",      "layering_piece", "A shirt is commonly worn as a base layer under knitwear, blazers, and waistcoats."),
    attr("tank",       "layering_piece", "A tank top is a minimal base layer worn under open shirts or jackets."),
    attr("turtleneck", "layering_piece", "A turtleneck is a base layer worn under coats and blazers."),
    attr("vest",       "layering_piece", "A vest is worn under a blazer or jacket as a layering piece."),
    attr("bodysuit",   "layering_piece", "A bodysuit functions as a fitted base layer."),
    attr("base-layer", "layering_piece", "A base layer is the innermost layer worn under insulating or outer pieces."),
    attr("dress",      "layering_piece", "A dress can act as a layering piece under an open jacket or denim jacket."),
    attr("knitwear",   "layering_piece", "Knitwear worn under a coat functions as an insulating mid layer."),

    // Things that go on top
    attr("blazer",       "outer_layer", "A blazer is an outer layer worn over shirts, turtlenecks, and vests."),
    attr("jacket",       "outer_layer", "A jacket is an outer layer worn over tops and base layers."),
    attr("coat",         "outer_layer", "A coat is the outermost layer worn over knitwear and turtlenecks."),
    attr("denim jacket", "outer_layer", "A denim jacket is a casual outer layer worn over dresses and t-shirts."),
    attr("cardigan",     "outer_layer", "A cardigan is a soft outer layer worn over t-shirts and base layers."),
    attr("puffer",       "outer_layer", "A puffer is a warm outer layer worn over base layers and knitwear."),
    attr("waistcoat",    "outer_layer", "A waistcoat is a structured outer layer worn over a shirt."),
    attr("knitwear",     "outer_layer", "Knitwear worn over a shirt or tank functions as a casual outer layer."),
  ];
}
