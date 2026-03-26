/**
 * Structured garment attribute extraction.
 *
 * Extracts typed attributes (fit, silhouette, collar, sleeve, closure, lining, length)
 * from product description text using pattern matching. Each attribute carries a
 * knowledge-graph mapping so it can be linked to `has_attribute` style rules and
 * used by the inference engine, trend matching, and outfit generation.
 */

export type GarmentAttributeKey =
  | "fit"
  | "silhouette"
  | "collar"
  | "sleeve"
  | "closure"
  | "lining"
  | "length";

export type GarmentAttribute = {
  /** Semantic category of the attribute */
  key: GarmentAttributeKey;
  /** Normalised value, e.g. "oversized", "drop-shoulder" */
  value: string;
  /** Original matched text fragment */
  raw: string;
  /** Where the value was found */
  source: "description" | "title";
  /**
   * Knowledge-graph edge mapping.
   * Each attribute produces a candidate `has_attribute` triple:
   *   <garment category> → has_attribute → <kg_object_value>
   * This feeds the inference engine and can be promoted to an explicit style rule.
   */
  kg_predicate: "has_attribute";
  kg_object_type: "attribute";
  kg_object_value: string;
};

export type ExtractedGarmentAttributes = {
  /** Primary fit descriptor, mapped to garment.fit */
  fit: string | null;
  /** Fabric composition or primary material, mapped to garment.material */
  material: string | null;
  /** Full structured attribute list, stored in extraction_metadata_json.attributes */
  attributes: GarmentAttribute[];
};

type AttributePattern = {
  pattern: RegExp;
  key: GarmentAttributeKey;
  value: string;
  kg_object_value: string;
};

const FIT_PATTERNS: AttributePattern[] = [
  { pattern: /\boversized\b/i,        key: "fit", value: "oversized", kg_object_value: "oversized" },
  { pattern: /\bboxy\b/i,             key: "fit", value: "oversized", kg_object_value: "oversized" },
  { pattern: /\btailored\b/i,         key: "fit", value: "tailored",  kg_object_value: "tailored"  },
  { pattern: /\bfitted\b/i,           key: "fit", value: "fitted",    kg_object_value: "fitted"    },
  { pattern: /\bslim[\s-]fit\b/i,     key: "fit", value: "slim",      kg_object_value: "slim"      },
  { pattern: /\brelaxed\b/i,          key: "fit", value: "relaxed",   kg_object_value: "relaxed"   },
  { pattern: /\bstraight[\s-]fit\b/i, key: "fit", value: "straight",  kg_object_value: "straight"  },
  { pattern: /\bwide[\s-]leg\b/i,     key: "fit", value: "wide-leg",  kg_object_value: "wide_leg"  },
  { pattern: /\bregular[\s-]fit\b/i,  key: "fit", value: "regular",   kg_object_value: "regular"   },
];

const SILHOUETTE_PATTERNS: AttributePattern[] = [
  { pattern: /\bcocoon\b/i,   key: "silhouette", value: "cocoon",  kg_object_value: "cocoon"  },
  { pattern: /\ba[\s-]line\b/i, key: "silhouette", value: "a-line", kg_object_value: "a_line"  },
  { pattern: /\bpeplum\b/i,   key: "silhouette", value: "peplum",  kg_object_value: "peplum"  },
  { pattern: /\bshift\b/i,    key: "silhouette", value: "shift",   kg_object_value: "shift"   },
  { pattern: /\bwrap\b/i,     key: "silhouette", value: "wrap",    kg_object_value: "wrap"    },
];

const COLLAR_PATTERNS: AttributePattern[] = [
  { pattern: /\bcollar\s+stand\b|\bstand\s+collar\b/i, key: "collar", value: "stand-collar",  kg_object_value: "stand_collar"  },
  { pattern: /\bturtleneck\b|\bhigh[\s-]neck\b/i,      key: "collar", value: "turtleneck",     kg_object_value: "turtleneck"    },
  { pattern: /\boff[\s-]shoulder\b/i,                  key: "collar", value: "off-shoulder",   kg_object_value: "off_shoulder"  },
  { pattern: /\bboat[\s-]neck\b/i,                     key: "collar", value: "boat-neck",      kg_object_value: "boat_neck"     },
  { pattern: /\bv[\s-]neck\b/i,                        key: "collar", value: "v-neck",         kg_object_value: "v_neck"        },
  { pattern: /\bcrew[\s-]neck\b/i,                     key: "collar", value: "crew-neck",      kg_object_value: "crew_neck"     },
  { pattern: /\blapel\b/i,                             key: "collar", value: "lapel",           kg_object_value: "lapel"         },
];

const SLEEVE_PATTERNS: AttributePattern[] = [
  { pattern: /\bdrop[\s-]shoulder\b/i,                                    key: "sleeve", value: "drop-shoulder",  kg_object_value: "drop_shoulder"        },
  { pattern: /\bsleeveless\b/i,                                           key: "sleeve", value: "sleeveless",     kg_object_value: "sleeveless"           },
  { pattern: /\b3\/4[\s-]sleeve\b|\bthree[\s-]quarter\s+sleeve\b/i,      key: "sleeve", value: "3/4-sleeve",     kg_object_value: "three_quarter_sleeve" },
  { pattern: /\braglan\b/i,                                               key: "sleeve", value: "raglan",         kg_object_value: "raglan"               },
  { pattern: /\blong[\s-]sleeve\b/i,                                      key: "sleeve", value: "long-sleeve",    kg_object_value: "long_sleeve"          },
  { pattern: /\bshort[\s-]sleeve\b/i,                                     key: "sleeve", value: "short-sleeve",   kg_object_value: "short_sleeve"         },
];

const CLOSURE_PATTERNS: AttributePattern[] = [
  { pattern: /\bdouble[\s-]breasted\b/i,                     key: "closure", value: "double-breasted",   kg_object_value: "double_breasted"   },
  { pattern: /\bsingle[\s-]breasted\b/i,                     key: "closure", value: "single-breasted",   kg_object_value: "single_breasted"   },
  { pattern: /\bconcealed\s+(?:zip|button|placket)\b/i,      key: "closure", value: "concealed-closure", kg_object_value: "concealed_closure" },
  { pattern: /\bbutton[\s-](?:up|down|front|through)\b/i,    key: "closure", value: "button-front",      kg_object_value: "button_front"      },
  { pattern: /\bzip[\s-]?(?:up|front)\b/i,                   key: "closure", value: "zip-front",         kg_object_value: "zip_front"         },
];

const LINING_PATTERNS: AttributePattern[] = [
  { pattern: /\bfully\s+lined\b/i, key: "lining", value: "lined",   kg_object_value: "lined"   },
  { pattern: /\bunlined\b/i,       key: "lining", value: "unlined", kg_object_value: "unlined" },
];

const LENGTH_PATTERNS: AttributePattern[] = [
  { pattern: /\bcrop(?:ped)?\b/i,       key: "length", value: "cropped",     kg_object_value: "cropped"      },
  { pattern: /\bmini\b/i,               key: "length", value: "mini",        kg_object_value: "mini"         },
  { pattern: /\bmidi\b/i,               key: "length", value: "midi",        kg_object_value: "midi"         },
  { pattern: /\bmaxi\b/i,               key: "length", value: "maxi",        kg_object_value: "maxi"         },
  { pattern: /\bknee[\s-]length\b/i,    key: "length", value: "knee-length", kg_object_value: "knee_length"  },
  { pattern: /\bankle[\s-]length\b/i,   key: "length", value: "ankle-length",kg_object_value: "ankle_length" },
];

const ALL_ATTRIBUTE_PATTERNS: AttributePattern[] = [
  ...FIT_PATTERNS,
  ...SILHOUETTE_PATTERNS,
  ...COLLAR_PATTERNS,
  ...SLEEVE_PATTERNS,
  ...CLOSURE_PATTERNS,
  ...LINING_PATTERNS,
  ...LENGTH_PATTERNS,
];

// Fabric keywords for material extraction fallback
const MATERIAL_KEYWORDS = [
  "wool", "cashmere", "merino", "silk", "satin",
  "linen", "cotton", "denim", "nylon", "polyester",
  "viscose", "rayon", "tencel", "lyocell", "modal",
  "velvet", "leather", "suede", "knit", "jersey",
  "elastane", "spandex", "acrylic",
] as const;

/**
 * Extract structured garment attributes from product text.
 *
 * Each attribute carries a `kg_object_value` that maps directly to the
 * `has_attribute` predicate in the knowledge graph, enabling:
 *   - Inference engine: derive `layerable_with` pairs from `has_attribute` classifications
 *   - Trend matching: match signals against attribute vocabulary
 *   - Outfit scoring: bonus/penalty rules based on silhouette balance
 *
 * Takes the first match per key — patterns are ordered by specificity/priority.
 */
export function extractGarmentAttributesFromText(
  text: string,
  source: "description" | "title" = "description"
): ExtractedGarmentAttributes {
  const attributes: GarmentAttribute[] = [];
  const seenKeys = new Set<GarmentAttributeKey>();

  for (const { pattern, key, value, kg_object_value } of ALL_ATTRIBUTE_PATTERNS) {
    if (seenKeys.has(key)) continue;
    const match = pattern.exec(text);
    if (match) {
      attributes.push({
        key,
        value,
        raw: match[0],
        source,
        kg_predicate: "has_attribute",
        kg_object_type: "attribute",
        kg_object_value,
      });
      seenKeys.add(key);
    }
  }

  const fitAttr = attributes.find((a) => a.key === "fit");

  return {
    fit: fitAttr?.value ?? null,
    material: extractMaterialFromText(text),
    attributes,
  };
}

function extractMaterialFromText(text: string): string | null {
  // Prefer an explicit composition line: "53% Cotton, 45% Nylon, 2% Elastane"
  const compositionMatch = /(\d+%\s*[A-Za-z]+(?:[,/\s]+\d+%\s*[A-Za-z]+)*)/i.exec(text);
  if (compositionMatch) {
    return compositionMatch[1].replace(/\s+/g, " ").trim();
  }

  // Fall back to keyword matching
  const found = MATERIAL_KEYWORDS.filter((kw) =>
    new RegExp(`\\b${kw}\\b`, "i").test(text)
  );
  return found.length > 0 ? found.join(", ") : null;
}
