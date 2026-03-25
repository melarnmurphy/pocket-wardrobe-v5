// lib/domain/style-rules/knowledge/materials.ts
//
// SCOPE: fibre-level rules only. Fabric construction (woven vs knitted, canvas vs lawn,
// jacquard, mechanical stretch, etc.) affects feel and use-case significantly but is
// modelled separately — see future `fabric_construction` rule type.
//
// RAYON FAMILY: viscose, lyocell, modal, tencel, cupro are all rayon variants.
// Rules are stored under the canonical "rayon" subject_value.
// Use rayonAliases to resolve user-entered fibre names to "rayon" at query time.
//
// POLYESTER / ACRYLIC: no quality or occasion avoidance rules are encoded here.
// Many formal and designer garments use these fibres. Whether polyester reads well
// depends on construction and weight, not fibre alone.

import type { SeedStyleRule } from "./index";

// Maps common names to canonical rule subject_value for query-time resolution.
export const materialAliases: Record<string, string> = {
  viscose: "rayon",
  lyocell: "rayon",
  tencel: "rayon",
  modal: "rayon",
  cupro: "rayon",
  lycra: "elastane",
  spandex: "elastane",
  merino: "wool",
  cashmere: "wool",    // cashmere also has its own rules below
  lambswool: "wool",
};

function mat(
  subject: string,
  predicate: string,
  objectType: string,
  object: string,
  weight: number,
  explanation: string
): SeedStyleRule {
  return {
    rule_type: "material",
    subject_type: "material",
    subject_value: subject,
    predicate,
    object_type: objectType,
    object_value: object,
    weight,
    rule_scope: "global",
    explanation,
    constraint_type: "soft",
  };
}

export function buildMaterialRules(): SeedStyleRule[] {
  return [
    // LINEN — plant fibre (flax); breathable; wrinkles easily but that's part of its character
    mat("linen", "works_in_weather", "weather", "warm_sun", 0.93, "Linen is highly breathable and one of the best natural fabrics for warm sunny weather."),
    mat("linen", "works_in_weather", "weather", "mild_clear", 0.85, "Linen works well in mild weather and stays comfortable throughout the day."),

    // WOOL — natural insulator; varieties include Merino (soft) and cashmere (luxurious)
    // Note: standard wool can be itchy against skin — Merino and cashmere are usually fine
    mat("wool", "works_in_weather", "weather", "cold_rain", 0.9, "Wool provides warmth and some moisture resistance in cold rainy conditions."),
    mat("wool", "works_in_weather", "weather", "cool_breeze", 0.88, "Wool is well suited to cool breezy weather as a mid or outer layer."),
    mat("wool", "has_property", "wear_note", "itch_risk", 0.72, "Standard wool can be itchy against skin. Merino, cashmere and lambswool are softer and usually itch-free."),

    // COTTON — the most used natural fabric; quality varies enormously regardless of percentage
    mat("cotton", "works_in_weather", "weather", "mild_clear", 0.85, "Cotton is a versatile breathable fabric that works well in mild clear conditions."),
    mat("cotton", "works_in_weather", "weather", "warm_sun", 0.82, "Cotton breathes well in warm weather, though linen is preferable for intense heat."),

    // CASHMERE — fine wool from cashmere goats; lightweight warmth, very soft
    mat("cashmere", "works_in_weather", "weather", "cool_breeze", 0.9, "Cashmere is light enough not to overheat but warm enough for cool breezy weather."),
    mat("cashmere", "works_in_weather", "weather", "cold_rain", 0.78, "Cashmere provides warmth in cold rain though it should be protected from moisture."),

    // SILK — luxury natural fibre; temperature-regulating; sheen and drape
    // Quality varies: buttery medium weight = good; papery, thin or uneven weave = lower quality
    mat("silk", "works_in_weather", "weather", "mild_clear", 0.88, "Silk is temperature-regulating and drapes beautifully in mild clear weather."),
    mat("silk", "works_in_weather", "weather", "warm_sun", 0.82, "Silk is lightweight and breathable in warm weather, though it marks easily."),
    mat("silk", "avoid_with", "weather", "cold_rain", 0.85, "Silk is prone to water spotting and should be avoided in cold rainy conditions."),
    mat("silk", "appropriate_for", "occasion", "evening", 0.92, "Silk's natural sheen and drape make it a strong choice for evening dressing."),
    mat("silk", "avoid_layering_with", "material", "silk", 0.8, "Silk on silk tends to slip and create static, making it a poor layering combination."),

    // LEATHER — durable natural material; improves with age
    mat("leather", "avoid_layering_with", "material", "leather", 0.85, "Layering leather on leather creates a tone-on-tone clash that reads heavy rather than intentional."),

    // RAYON — canonical name for plant-based semi-synthetic fibres:
    // viscose, lyocell (Tencel), modal, cupro. Made from wood or bamboo pulp.
    // Viscose is particularly versatile — more uniform than natural fibres,
    // can be made into many fabric types. Quality varies widely across brands.
    // All rayon variants are breathable and drape well; they weaken when wet.
    mat("rayon", "works_in_weather", "weather", "warm_sun", 0.85, "Rayon (viscose, lyocell, modal, tencel) is breathable and drapes well in warm weather."),
    mat("rayon", "works_in_weather", "weather", "mild_clear", 0.88, "Rayon is a breathable plant-based fibre that works well across mild conditions."),
    mat("rayon", "avoid_with", "weather", "cold_rain", 0.82, "Rayon weakens when wet and tends to cling uncomfortably in cold rainy conditions."),
    mat("rayon", "texture_contrast_with", "material", "denim", 0.8, "The soft drape of rayon creates an interesting contrast with the structure of denim."),

    // NYLON — synthetic; strong, lightweight, water-resistant; often added in small amounts for strength
    mat("nylon", "works_in_weather", "weather", "cold_rain", 0.88, "Nylon is water-resistant and reliable in cold rainy weather, especially in outerwear."),

    // DENIM — twill-weave cotton construction; structurally distinct
    mat("denim", "texture_contrast_with", "material", "silk", 0.82, "Denim and silk create a productive contrast between rough and refined textures."),
    mat("denim", "texture_contrast_with", "material", "satin", 0.84, "Denim and satin create a high-contrast pairing of casual and elevated textures."),
    mat("denim", "texture_contrast_with", "material", "rayon", 0.8, "The soft drape of rayon creates an interesting contrast with the structure of denim."),

    // POPLIN — lightweight plain-weave; the classic shirting fabric
    mat("poplin", "works_in_weather", "weather", "warm_sun", 0.9, "Poplin is a lightweight crisp fabric that stays cool and comfortable in warm weather."),
    mat("poplin", "works_in_weather", "weather", "mild_clear", 0.88, "Poplin's plain weave breathes well and works across mild conditions."),
    mat("poplin", "appropriate_for", "occasion", "business_casual", 0.88, "Poplin's clean, crisp finish makes it a natural choice for business-casual shirting."),

    // CHIFFON — sheer, lightweight; loses drape when wet
    mat("chiffon", "works_in_weather", "weather", "warm_sun", 0.88, "Chiffon is sheer and lightweight, making it a natural choice for warm sunny weather."),
    mat("chiffon", "works_in_weather", "weather", "mild_clear", 0.84, "Chiffon drapes beautifully in mild clear conditions."),
    mat("chiffon", "avoid_with", "weather", "cold_rain", 0.88, "Chiffon loses its drape when wet and is not suited to cold rainy weather."),
    mat("chiffon", "appropriate_for", "occasion", "evening", 0.9, "Chiffon's delicate, flowing quality makes it a strong choice for evening dressing."),

    // SATIN — smooth weave with a shiny face; formal and evening territory
    mat("satin", "appropriate_for", "occasion", "evening", 0.92, "Satin's smooth sheen and fluid drape make it a go-to fabric for evening dressing."),
    mat("satin", "texture_contrast_with", "material", "denim", 0.84, "Satin and denim create a high-contrast pairing of elevated and casual textures."),
    mat("satin", "texture_contrast_with", "material", "cotton", 0.8, "Satin's sheen contrasts well with the matte texture of cotton for a polished mix."),

    // TWEED — dense woven wool construction; structured and textural
    mat("tweed", "works_in_weather", "weather", "cool_breeze", 0.85, "Tweed's dense weave makes it a strong choice for cool breezy conditions."),
    mat("tweed", "texture_contrast_with", "material", "cotton", 0.78, "Tweed and cotton pair well by contrasting structured texture against a clean base."),
  ];
}
