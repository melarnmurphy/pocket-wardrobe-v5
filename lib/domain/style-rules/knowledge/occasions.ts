// lib/domain/style-rules/knowledge/occasions.ts
import type { SeedStyleRule } from "./index";

export const occasionProfiles = [
  "active",
  "beach",
  "business_casual",
  "casual",
  "evening",
  "formal_evening",
  "lifestyle_sport",
  "smart_casual",
  "streetwear",
  "wardrobe_essentials",
  "workwear",
] as const;

export type OccasionProfile = (typeof occasionProfiles)[number];

function occ(
  subject: string,
  occasion: OccasionProfile,
  weight: number,
  explanation: string
): SeedStyleRule {
  return {
    rule_type: "occasion_fit",
    subject_type: "category",
    subject_value: subject,
    predicate: "appropriate_for",
    object_type: "occasion",
    object_value: occasion,
    weight,
    rule_scope: "global",
    explanation,
    constraint_type: "soft",
  };
}

export function buildOccasionRules(): SeedStyleRule[] {
  return [
    // BUSINESS CASUAL
    occ("white shirt",        "business_casual", 0.95, "A white shirt is a strong business-casual base layer."),
    occ("blazer",             "business_casual", 0.92, "A blazer makes business-casual outfits feel intentional without forcing full suiting."),
    occ("tailored trousers",  "business_casual", 0.9,  "Tailored trousers anchor business-casual outfits with structure."),

    // EVENING
    occ("dress",              "evening", 0.86, "A dress often transitions easily into evening dressing depending on fabrication and styling."),
    occ("heels",              "evening", 0.84, "Heels often elevate a look for evening settings."),
    occ("silk top",           "evening", 0.82, "A silk top reads elevated and is well-suited to evening dressing."),

    // WORKWEAR
    occ("white shirt",        "workwear", 0.95, "A white shirt is a reliable and versatile workwear base layer."),
    occ("blazer",             "workwear", 0.92, "A blazer adds structure and intention to a workwear look."),
    occ("tailored trousers",  "workwear", 0.9,  "Tailored trousers are a core workwear piece that anchors polished dressing."),
    occ("loafers",            "workwear", 0.84, "Loafers are a smart, low-effort workwear shoe that bridges casual and professional."),

    // SMART CASUAL
    occ("blazer",             "smart_casual", 0.88, "A blazer elevates smart-casual outfits without requiring full suiting."),
    occ("chinos",             "smart_casual", 0.85, "Chinos sit comfortably in smart-casual territory — polished without being stiff."),
    occ("polo shirt",         "smart_casual", 0.8,  "A polo shirt reads polished enough for smart-casual occasions."),
    occ("loafers",            "smart_casual", 0.82, "Loafers are a versatile smart-casual shoe that works across many settings."),

    // CASUAL
    occ("sneakers",           "casual", 0.9,  "Sneakers are a safe and easy casual footwear base."),
    occ("denim jacket",       "casual", 0.82, "A denim jacket reads casual and relaxed across most settings."),
    occ("t-shirt",            "casual", 0.88, "A t-shirt is the foundation of casual dressing."),
    occ("jeans",              "casual", 0.87, "Jeans are the most versatile casual bottom and a wardrobe staple."),

    // FORMAL / EVENING
    occ("evening dress",      "formal_evening", 0.95, "An evening dress is purpose-built for formal and evening occasions."),
    occ("heels",              "formal_evening", 0.88, "Heels elevate a look for formal and evening settings."),
    occ("suit",               "formal_evening", 0.9,  "A suit reads well at formal evening events depending on fabrication and styling."),
    occ("silk top",           "formal_evening", 0.85, "A silk top transitions naturally into evening dressing."),

    // STREETWEAR
    occ("hoodie",             "streetwear", 0.9,  "A hoodie is a streetwear staple — relaxed, graphic-friendly, and urban in feel."),
    occ("sneakers",           "streetwear", 0.92, "Sneakers are central to streetwear styling."),
    occ("bomber jacket",      "streetwear", 0.88, "A bomber jacket is a classic streetwear outer layer."),
    occ("track pants",        "streetwear", 0.85, "Track pants are a streetwear-coded bottom that reads relaxed and intentional."),

    // BEACH
    occ("bikini",             "beach", 0.98, "A bikini is the core beach and swimwear piece."),
    occ("beach dress",        "beach", 0.92, "A beach dress or cover-up is a natural transition piece from water to shore."),
    occ("sandals",            "beach", 0.9,  "Sandals are the go-to beach footwear."),

    // ACTIVE
    occ("leggings",           "active", 0.95, "Leggings are a core active and athletic bottom."),
    occ("sports top",         "active", 0.92, "A sports top or base layer is suited to active and training occasions."),
    occ("trainers",           "active", 0.95, "Trainers are the standard footwear for active and athletic wear."),

    // LIFESTYLE SPORT
    occ("polo shirt",         "lifestyle_sport", 0.88, "A polo shirt has strong lifestyle-sport roots and works well in relaxed outdoor settings."),
    occ("sneakers",           "lifestyle_sport", 0.85, "Sneakers bridge active and lifestyle-sport dressing comfortably."),
    occ("chinos",             "lifestyle_sport", 0.78, "Chinos work in lifestyle-sport contexts when paired with a clean top."),

    // WARDROBE ESSENTIALS
    occ("white t-shirt",      "wardrobe_essentials", 0.95, "A white t-shirt is the most foundational wardrobe essential."),
    occ("jeans",              "wardrobe_essentials", 0.95, "Jeans are a wardrobe essential that anchors casual dressing across decades."),
    occ("white shirt",        "wardrobe_essentials", 0.92, "A white shirt is a versatile essential that works across casual, smart, and formal settings."),
    occ("trench coat",        "wardrobe_essentials", 0.9,  "A trench coat is a transitional essential that works across seasons and settings."),
    occ("blazer",             "wardrobe_essentials", 0.88, "A well-fitted blazer is a core wardrobe essential that elevates almost any outfit."),
  ];
}
