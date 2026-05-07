import type { ProductMetadata, ReceiptDraftCandidate } from "./extractors";
import { PIPELINE_MODEL_ID } from "./index";

export type IngestionAdapterKind =
  | "direct_upload"
  | "product_url"
  | "receipt"
  | "outfit_decomposition";

export type DraftFieldName =
  | "title"
  | "category"
  | "colour"
  | "brand"
  | "material"
  | "style"
  | "retailer"
  | "purchase_price"
  | "purchase_currency";

export type ReviewDraftAdapterPayload = {
  sourceType: IngestionAdapterKind;
  title: string | null;
  category: string | null;
  colour: string | null;
  brand: string | null;
  material: string | null;
  style: string | null;
  notes: string | null;
  sourceLabel: string | null;
  confidence: number;
  retailer: string | null;
  purchasePrice: number | null;
  purchaseCurrency: string | null;
  extractionSource: string;
  metadata: Record<string, unknown>;
  bbox?: [number, number, number, number] | null;
  tag?: string | null;
  embedding?: number[] | null;
  fieldConfidence?: Partial<Record<DraftFieldName, number>>;
  fieldProvenance?: Partial<Record<DraftFieldName, string>>;
};

export interface IngestionAdapter<TInput, TOutput = ReviewDraftAdapterPayload> {
  kind: IngestionAdapterKind;
  buildDraft(input: TInput): TOutput;
}

export function parseProductPrice(value: string | null | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Number(value.replace(/[^0-9.]+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export const productUrlAdapter: IngestionAdapter<{
  productUrl: string;
  titleHint: string;
  notes?: string | null;
  extracted: ProductMetadata;
}> = {
  kind: "product_url",
  buildDraft(input) {
    const url = new URL(input.productUrl);
    const extractedPrice = parseProductPrice(input.extracted.price);
    const usedRetailerMetadata = Boolean(
      input.extracted.brand ||
        input.extracted.category ||
        input.extracted.price ||
        input.extracted.image_url ||
        input.extracted.description ||
        (input.extracted.title && input.extracted.title !== input.titleHint)
    );
    const extractionSource = usedRetailerMetadata
      ? "retailer metadata"
      : input.titleHint
        ? "manual hint"
        : "URL fallback";
    const confidence = input.extracted.title || input.extracted.category ? 0.72 : 0.42;

    const fieldConfidence: Partial<Record<DraftFieldName, number>> = {};
    const fieldProvenance: Partial<Record<DraftFieldName, string>> = {};

    if (input.extracted.title) {
      fieldConfidence.title = 0.8;
      fieldProvenance.title = "ai_text";
    } else if (input.titleHint) {
      fieldConfidence.title = 0.45;
      fieldProvenance.title = "url_parse";
    }

    if (input.extracted.category) {
      fieldConfidence.category = 0.75;
      fieldProvenance.category = "ai_text";
    } else {
      fieldConfidence.category = 0.2;
      fieldProvenance.category = "rule_based";
    }

    if (input.extracted.colour) {
      fieldConfidence.colour = 0.7;
      fieldProvenance.colour = "ai_text";
    }
    if (input.extracted.brand) {
      fieldConfidence.brand = 0.8;
      fieldProvenance.brand = "ai_text";
    }
    if (input.extracted.material) {
      fieldConfidence.material = 0.7;
      fieldProvenance.material = "ai_text";
    }
    if (input.extracted.fit) {
      fieldConfidence.style = 0.65;
      fieldProvenance.style = "ai_text";
    }
    if (input.extracted.retailer) {
      fieldConfidence.retailer = 0.85;
      fieldProvenance.retailer = "ai_text";
    }
    if (extractedPrice !== null) {
      fieldConfidence.purchase_price = 0.85;
      fieldProvenance.purchase_price = "ai_text";
    }
    if (input.extracted.currency) {
      fieldConfidence.purchase_currency = 0.85;
      fieldProvenance.purchase_currency = "ai_text";
    }

    return {
      sourceType: "product_url",
      title: input.extracted.title || input.titleHint,
      category: input.extracted.category ?? "top",
      colour: input.extracted.colour,
      brand: input.extracted.brand,
      material: input.extracted.material,
      style: input.extracted.fit,
      notes:
        input.notes ??
        input.extracted.description ??
        `Review this product-link draft from ${url.hostname}.`,
      sourceLabel: url.hostname,
      confidence,
      retailer: input.extracted.retailer,
      purchasePrice: extractedPrice,
      purchaseCurrency: input.extracted.currency,
      extractionSource,
      metadata: {
        source_url: input.productUrl,
        title_hint: input.titleHint,
        extraction_source: extractionSource,
        extracted_title: input.extracted.title,
        extracted_category: input.extracted.category,
        extracted_colour: input.extracted.colour,
        extracted_brand: input.extracted.brand,
        extracted_retailer: input.extracted.retailer,
        extracted_price: input.extracted.price,
        extracted_currency: input.extracted.currency,
        extracted_image_url: input.extracted.image_url,
        extracted_fit: input.extracted.fit,
        extracted_material: input.extracted.material,
        extracted_attributes: input.extracted.attributes,
        extracted_styling_suggestions: input.extracted.styling_suggestions
      },
      fieldConfidence,
      fieldProvenance
    };
  }
};

export const directUploadAdapter: IngestionAdapter<{
  fileName: string;
  notes?: string | null;
  detected?: {
    category: string;
    confidence: number;
    bbox: [number, number, number, number];
    colour: string;
    material: string;
    style: string;
    tag: string;
    embedding: number[];
  } | null;
}> = {
  kind: "direct_upload",
  buildDraft(input) {
    const normalizedTitle = input.fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim();

    if (input.detected) {
      const c = input.detected.confidence;
      return {
        sourceType: "direct_upload",
        title: input.detected.tag,
        category: input.detected.category,
        colour: input.detected.colour,
        brand: null,
        material: input.detected.material,
        style: input.detected.style,
        notes: input.notes ?? null,
        sourceLabel: input.fileName,
        confidence: c,
        retailer: null,
        purchasePrice: null,
        purchaseCurrency: null,
        extractionSource: "image analysis",
        bbox: input.detected.bbox,
        tag: input.detected.tag,
        embedding: input.detected.embedding,
        metadata: {
          original_filename: input.fileName,
          extraction_source: "image analysis",
          detector_model: PIPELINE_MODEL_ID
        },
        fieldConfidence: { title: c, category: c, colour: c, material: c, style: c },
        fieldProvenance: {
          title: "ai_vision",
          category: "ai_vision",
          colour: "ai_vision",
          material: "ai_vision",
          style: "ai_vision"
        }
      };
    }

    return {
      sourceType: "direct_upload",
      title: normalizedTitle || "Photo upload",
      category: "",
      colour: "",
      brand: null,
      material: null,
      style: "manual photo entry",
      notes:
        input.notes ??
        "Uploaded without assisted feature labelling. Fill in the garment details manually.",
      sourceLabel: input.fileName,
      confidence: 0.05,
      retailer: null,
      purchasePrice: null,
      purchaseCurrency: null,
      extractionSource: "manual entry",
      metadata: {
        original_filename: input.fileName,
        extraction_source: "manual entry"
      }
    };
  }
};

export const receiptAdapter: IngestionAdapter<{
  candidate: ReceiptDraftCandidate;
  fileName: string;
  notes?: string | null;
  extractionSource: string;
}> = {
  kind: "receipt",
  buildDraft(input) {
    const c = input.candidate.confidence;
    const fieldConfidence: Partial<Record<DraftFieldName, number>> = {};
    const fieldProvenance: Partial<Record<DraftFieldName, string>> = {};

    if (input.candidate.title) {
      fieldConfidence.title = c; fieldProvenance.title = "ai_text";
    }
    if (input.candidate.category) {
      fieldConfidence.category = c; fieldProvenance.category = "ai_text";
    }
    if (input.candidate.colour) {
      fieldConfidence.colour = c; fieldProvenance.colour = "ai_text";
    }
    if (input.candidate.brand) {
      fieldConfidence.brand = c; fieldProvenance.brand = "ai_text";
    }
    if (input.candidate.retailer) {
      fieldConfidence.retailer = c; fieldProvenance.retailer = "ai_text";
    }
    if (input.candidate.price !== null && input.candidate.price !== undefined) {
      fieldConfidence.purchase_price = c; fieldProvenance.purchase_price = "ai_text";
    }
    if (input.candidate.currency) {
      fieldConfidence.purchase_currency = c; fieldProvenance.purchase_currency = "ai_text";
    }

    return {
      sourceType: "receipt",
      title: input.candidate.title,
      category: input.candidate.category,
      colour: input.candidate.colour,
      brand: input.candidate.brand,
      material: null,
      style: "receipt import",
      notes: input.notes ?? input.candidate.notes ?? "Review this receipt-derived draft.",
      sourceLabel: input.fileName,
      confidence: c,
      retailer: input.candidate.retailer,
      purchasePrice: input.candidate.price,
      purchaseCurrency: input.candidate.currency,
      extractionSource: input.extractionSource,
      metadata: {
        original_filename: input.fileName,
        extraction_source: input.extractionSource,
        receipt_retailer: input.candidate.retailer,
        receipt_price: input.candidate.price,
        receipt_currency: input.candidate.currency
      },
      fieldConfidence,
      fieldProvenance
    };
  }
};

export const outfitDecompositionAdapter: IngestionAdapter<{
  fileName: string;
  detected?: {
    category: string;
    confidence: number;
    bbox: [number, number, number, number];
    colour: string;
    material: string;
    style: string;
    tag: string;
    embedding: number[];
  } | null;
  role?: string | null;
  notes?: string | null;
}> = {
  kind: "outfit_decomposition",
  buildDraft(input) {
    if (input.detected) {
      const c = input.detected.confidence;
      return {
        sourceType: "outfit_decomposition",
        title: input.detected.tag,
        category: input.detected.category,
        colour: input.detected.colour,
        brand: null,
        material: input.detected.material,
        style: input.detected.style,
        notes: input.notes ?? "Review this outfit-derived candidate before saving it as an owned garment.",
        sourceLabel: input.fileName,
        confidence: c,
        retailer: null,
        purchasePrice: null,
        purchaseCurrency: null,
        extractionSource: "image analysis",
        bbox: input.detected.bbox,
        tag: input.detected.tag,
        embedding: input.detected.embedding,
        metadata: {
          original_filename: input.fileName,
          extraction_source: "image analysis",
          detector_model: PIPELINE_MODEL_ID
        },
        fieldConfidence: { title: c, category: c, colour: c, material: c, style: c },
        fieldProvenance: {
          title: "ai_vision",
          category: "ai_vision",
          colour: "ai_vision",
          material: "ai_vision",
          style: "ai_vision"
        }
      };
    }

    const normalizedTitle = input.fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim();

    return {
      sourceType: "outfit_decomposition",
      title: normalizedTitle || "Outfit item",
      category: "",
      colour: "",
      brand: null,
      material: null,
      style: input.role ?? "outfit decomposition",
      notes:
        input.notes ??
        "Review this outfit-derived candidate before saving it as an owned garment.",
      sourceLabel: input.fileName,
      confidence: 0.12,
      retailer: null,
      purchasePrice: null,
      purchaseCurrency: null,
      extractionSource: "outfit decomposition scaffold",
      metadata: {
        original_filename: input.fileName,
        role: input.role ?? null,
        extraction_source: "outfit decomposition scaffold"
      }
    };
  }
};
