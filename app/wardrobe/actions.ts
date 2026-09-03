"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import {
  createCollection,
  createGarment,
  addGarment3dAsset,
  addGarmentImage,
  addGarmentToLetGo,
  archiveGarment,
  deleteCollection,
  deleteGarment,
  getGarmentUsageBlockers,
  mergeGarments,
  removeGarmentFromLetGo,
  renameCollection,
  restoreGarment,
  findGarmentPriceMatchCandidates,
  setGarmentAvailability,
  setGarmentPriceManually,
  setGarmentSeasonalStorage,
  unarchiveGarment,
  setGarmentFeatureImage,
  setGarmentPrimaryColourFamily,
  toggleGarmentFavourite,
  updateGarment
} from "@/lib/domain/wardrobe/service";
import { availabilitySchema, letGoReasonSchema } from "@/lib/domain/wardrobe";
import {
  type WardrobeColourFamily
} from "@/lib/domain/wardrobe/colours";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";
import {
  deleteWearEvent,
  incrementWearCount,
  logWearEvent,
  updateWearEvent
} from "@/lib/domain/wear-events/service";
import {
  attachPriceMatchCandidates,
  createGarmentSource,
  createDraftsFromPipelineResult,
  createManualPhotoReviewDraft,
  createManualReviewDraft,
  createProductUrlSource,
  createReceiptSource
} from "@/lib/domain/ingestion/service";
import {
  callPipelineService,
  callReceiptOcrService
} from "@/lib/domain/ingestion/client";
import { canUseFeatureLabels } from "@/lib/domain/entitlements/service";
import {
  extractProductMetadataFromUrl,
  extractSizeFromNotes,
  parseReceiptDraftCandidates,
  readReceiptTextFromFile
} from "@/lib/domain/ingestion/extractors";
import { productUrlAdapter, receiptAdapter } from "@/lib/domain/ingestion/adapters";
import { classifyUploadFile, MAX_UPLOAD_BYTES } from "@/lib/domain/ingestion/limits";

const nullableText = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    },
    z.string().max(max).nullable().optional()
  );

const optionalTimestampInput = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return parsed.toISOString();
}, z.string().min(1).optional());

const createGarmentFormSchema = z.object({
  title: nullableText(200),
  brand: nullableText(120),
  category: z.string().trim().min(1).max(100),
  subcategory: nullableText(100),
  material: nullableText(120),
  size: nullableText(40),
  fit: nullableText(80),
  formality_level: nullableText(80),
  purchase_currency: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null),
    z.string().length(3).nullable().optional()
  ),
  purchase_price: z.preprocess((value) => {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    return Number(value);
  }, z.number().nonnegative().nullable().optional()),
  purchase_date: nullableText(10),
  retailer: nullableText(200),
  primary_colour_family: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null),
    z.string().nullable().optional()
  ),
  seasonality: z.array(z.string().trim().min(1)).default([])
});

const addGarmentImageFormSchema = z.object({
  garment_id: z.string().uuid(),
  width: z.preprocess((value) => {
    if (typeof value !== "string" || !value.trim()) {
      return undefined;
    }

    return Number.parseInt(value, 10);
  }, z.number().int().positive().optional()),
  height: z.preprocess((value) => {
    if (typeof value !== "string" || !value.trim()) {
      return undefined;
    }

    return Number.parseInt(value, 10);
  }, z.number().int().positive().optional())
});

const addGarment3dAssetFormSchema = z.object({
  garment_id: z.string().uuid(),
  asset_type: z.enum(["model", "texture", "material", "simulation_preset", "thumbnail"]),
  source_type: z.enum(["manual", "designer_asset", "generated", "partner_import", "scan"]).default("manual"),
  file_format: nullableText(24),
  material_name: nullableText(80),
  fabric_weight: nullableText(80),
  stretch: nullableText(80),
  drape: nullableText(80),
  notes: nullableText(1000)
});

const logWearFormSchema = z.object({
  garment_id: z.string().uuid(),
  entry_mode: z.enum(["quick", "detail"]).default("detail"),
  wears_to_add: z.preprocess((value) => {
    if (typeof value !== "string" || !value.trim()) {
      return 1;
    }

    return Number(value);
  }, z.number().int().positive().default(1)),
  worn_at: optionalTimestampInput,
  occasion: nullableText(120),
  notes: nullableText(2000)
});

const deleteGarmentFormSchema = z.object({
  garment_id: z.string().uuid()
});

const bulkGarmentIdsFormSchema = z.object({
  garment_id: z.array(z.string().uuid()).min(1)
});

const mergeGarmentsFormSchema = z.object({
  source_garment_id: z.string().uuid(),
  target_garment_id: z.string().uuid()
});

const updateWearEventFormSchema = z.object({
  wear_event_id: z.string().uuid(),
  worn_at: nullableText(40),
  occasion: nullableText(120),
  notes: nullableText(2000)
});

const deleteWearEventFormSchema = z.object({
  wear_event_id: z.string().uuid()
});

const createCollectionFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  garment_id: z.array(z.string().uuid()).default([])
});

const renameCollectionFormSchema = z.object({
  collection_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120)
});

const deleteCollectionFormSchema = z.object({
  collection_id: z.string().uuid()
});

const setAvailabilityFormSchema = z.object({
  garment_id: z.string().uuid(),
  availability: availabilitySchema
});

const setSeasonalStorageFormSchema = z.object({
  garment_id: z.string().uuid(),
  stored: z.enum(["true", "false"])
});

const addToLetGoFormSchema = z.object({
  garment_id: z.string().uuid(),
  reason: letGoReasonSchema,
  estimate_cents: z.coerce.number().int().nonnegative().nullable().optional()
});

const removeFromLetGoFormSchema = z.object({
  garment_id: z.string().uuid()
});

const archiveGarmentFormSchema = z.object({
  garment_id: z.string().uuid(),
  reason: nullableText(200)
});

const setPriceManuallyFormSchema = z.object({
  garment_id: z.string().uuid(),
  price: z.coerce.number().nonnegative(),
  currency: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim().toUpperCase() : "AUD"),
    z.string().length(3)
  )
});

const setFeatureImageFormSchema = z.object({
  garment_id: z.string().uuid(),
  image_id: z.string().uuid()
});

const updateGarmentFormSchema = createGarmentFormSchema.extend({
  garment_id: z.string().uuid()
});

const productUrlDraftFormSchema = z.object({
  product_url: z.string().trim().url(),
  title_hint: nullableText(200),
  notes: nullableText(1000)
});

const receiptDraftFormSchema = z.object({
  receipt_text: nullableText(5000),
  notes: nullableText(1000),
  source_width: z.preprocess((value) => {
    if (typeof value !== "string" || !value.trim()) {
      return undefined;
    }

    return Number.parseInt(value, 10);
  }, z.number().int().positive().optional()),
  source_height: z.preprocess((value) => {
    if (typeof value !== "string" || !value.trim()) {
      return undefined;
    }

    return Number.parseInt(value, 10);
  }, z.number().int().positive().optional())
});

const photoDraftFormSchema = z.object({
  source_width: z.preprocess((value) => {
    if (typeof value !== "string" || !value.trim()) {
      return undefined;
    }

    return Number.parseInt(value, 10);
  }, z.number().int().positive().optional()),
  source_height: z.preprocess((value) => {
    if (typeof value !== "string" || !value.trim()) {
      return undefined;
    }

    return Number.parseInt(value, 10);
  }, z.number().int().positive().optional())
});

export async function createGarmentAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = normalizeCategoryInput(
      createGarmentFormSchema.parse({
      title: formData.get("title"),
      brand: formData.get("brand"),
      category: formData.get("category"),
      subcategory: formData.get("subcategory"),
      material: formData.get("material"),
      size: formData.get("size"),
      fit: formData.get("fit"),
      formality_level: formData.get("formality_level"),
      purchase_currency: formData.get("purchase_currency"),
      purchase_price: formData.get("purchase_price"),
      purchase_date: formData.get("purchase_date"),
      retailer: formData.get("retailer"),
      primary_colour_family: formData.get("primary_colour_family"),
      seasonality: formData.getAll("seasonality")
      })
    );

    const garment = await createGarment(values, {
      primaryColourFamily: values.primary_colour_family as WardrobeColourFamily | null | undefined
    });
    const file = formData.get("image");

    if (file instanceof File && file.size > 0) {
      try {
        await addGarmentImage({
          garmentId: garment.id as string,
          file
        });
      } catch (error) {
        revalidatePath("/wardrobe");
        return {
          status: "partial",
          garmentId: garment.id as string,
          message:
            error instanceof Error
              ? `Item added, but image upload failed: ${error.message}`
              : "Item added, but image upload failed."
        };
      }
    }

    revalidatePath("/wardrobe");

    return {
      status: "success",
      garmentId: garment.id as string,
      message: file instanceof File && file.size > 0 ? "Item added with image." : "Item added."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to add item."
    };
  }
}

export async function createPhotoDraftAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const file = formData.get("image");

    if (!(file instanceof File) || file.size === 0) {
      return {
        status: "error",
        message: "Choose an image to analyse."
      };
    }

    const uploadCheck = classifyUploadFile(file);
    if (uploadCheck !== "ok") {
      return {
        status: "error",
        errorCode: uploadCheck,
        message:
          uploadCheck === "unsupported_format"
            ? "That file type won't open. Garderobe reads JPEG, PNG and WEBP."
            : "That photo's too large. Photos over 20MB won't upload."
      };
    }

    const values = photoDraftFormSchema.parse({
      source_width: formData.get("source_width"),
      source_height: formData.get("source_height")
    });

    const { sourceId, storagePath } = await createGarmentSource({
      file,
      width: values.source_width,
      height: values.source_height
    });
    const featureLabelsEnabled = await canUseFeatureLabels();

    if (!featureLabelsEnabled) {
      const draftId = await createManualPhotoReviewDraft({
        sourceId,
        fileName: file.name
      });

      revalidatePath("/wardrobe/review");

      return {
        status: "success",
        draftIds: [draftId],
        nextPath: "/wardrobe/review",
        message: "Photo uploaded. Fill in the garment details manually."
      };
    }

    const supabase = await createClient();
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("garment-originals")
      .createSignedUrl(storagePath, 5 * 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return {
        status: "error",
        message: "Failed to prepare image for analysis."
      };
    }

    const env = getServerEnv();
    const result = await callPipelineService({
      serviceUrl: env.PIPELINE_SERVICE_URL,
      imageUrl: signedUrlData.signedUrl
    });

    const draftIds = await createDraftsFromPipelineResult({
      sourceId,
      storagePath,
      result
    });

    revalidatePath("/wardrobe/review");

    return {
      status: "success",
      draftIds,
      nextPath: "/wardrobe/review",
      message:
        draftIds.length > 0
          ? `${draftIds.length} draft${draftIds.length === 1 ? "" : "s"} ready to review.`
          : "No garments detected from that image."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not analyse photo."
    };
  }
}

export async function createProductUrlDraftAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = productUrlDraftFormSchema.parse({
      product_url: formData.get("product_url"),
      title_hint: formData.get("title_hint"),
      notes: formData.get("notes")
    });

    const url = new URL(values.product_url);
    const titleHint =
      values.title_hint ||
      decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "")
        .replace(/[-_]+/g, " ")
        .trim() ||
      url.hostname;
    const extracted = await extractProductMetadataFromUrl(values.product_url);
    if (extracted.fetch_failed) {
      return {
        status: "error",
        errorCode: "dead_url",
        message: "That link didn't load, so nothing came back automatically. Add the piece's details yourself instead."
      };
    }
    const { sourceId } = await createProductUrlSource({ url: values.product_url });
    const draftPayload = productUrlAdapter.buildDraft({
      productUrl: values.product_url,
      titleHint,
      notes: values.notes,
      extracted
    });
    const normalizedCategory = normalizeCategoryParts(draftPayload.category);
    const draftMetadata = {
      ...draftPayload.metadata,
      category_descriptors: normalizedCategory.descriptors,
      size_hint: extractSizeFromNotes(values.notes)
    };
    const draftId = await createManualReviewDraft({
      sourceId,
      sourceType: draftPayload.sourceType,
      title: draftPayload.title,
      category: normalizedCategory.primaryCategory ?? draftPayload.category,
      colour: draftPayload.colour,
      brand: draftPayload.brand,
      material: draftPayload.material,
      style: draftPayload.style,
      notes: draftPayload.notes,
      sourceLabel: draftPayload.sourceLabel,
      confidence: draftPayload.confidence,
      retailer: draftPayload.retailer,
      purchasePrice: draftPayload.purchasePrice,
      purchaseCurrency: draftPayload.purchaseCurrency,
      extractionSource: draftPayload.extractionSource,
      metadata: draftMetadata,
      fieldConfidence: draftPayload.fieldConfidence,
      fieldProvenance: draftPayload.fieldProvenance
    });

    const supabase = await createClient();
    await supabase
      .from("garment_sources")
      .update({
        parse_status: "requires_review",
        confidence: draftPayload.confidence,
        source_metadata_json: draftMetadata
      } as never)
      .eq("id", sourceId);

    revalidatePath("/wardrobe/review");

    return {
      status: "success",
      draftIds: [draftId],
      nextPath: "/wardrobe/review",
      message: "Product link draft created. Review the inferred details before saving."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not add item from product link."
    };
  }
}

export async function createReceiptDraftAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const file = formData.get("receipt");

    if (!(file instanceof File) || file.size === 0) {
      return {
        status: "error",
        message: "Choose a receipt file to upload."
      };
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return {
        status: "error",
        errorCode: "too_large",
        message: "That file's too large. Files over 20MB won't upload."
      };
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      const uploadCheck = classifyUploadFile(file);
      if (uploadCheck !== "ok") {
        return {
          status: "error",
          errorCode: uploadCheck,
          message:
            uploadCheck === "unsupported_format"
              ? "That file type won't open. Garderobe reads JPEG, PNG, WEBP and PDF receipts."
              : "That file's too large. Files over 20MB won't upload."
        };
      }
    }

    const values = receiptDraftFormSchema.parse({
      receipt_text: formData.get("receipt_text"),
      notes: formData.get("notes"),
      source_width: formData.get("source_width"),
      source_height: formData.get("source_height")
    });

    const { sourceId } = await createReceiptSource({
      file,
      width: values.source_width,
      height: values.source_height
    });
    const fileText = await readReceiptTextFromFile(file);
    const ocrText =
      fileText || !shouldAttemptReceiptOcr(file)
        ? null
        : await callReceiptOcrService({
            serviceUrl: getServerEnv().PIPELINE_SERVICE_URL,
            file
          }).catch(() => null);
    const receiptText = [values.receipt_text, fileText, ocrText].filter(Boolean).join("\n");
    const hasStrongReceiptText = receiptText.trim().length > 0;
    const extractionSource = values.receipt_text
      ? "pasted text"
      : fileText
        ? "text-readable file"
        : ocrText
          ? "OCR"
          : "filename fallback";
    const fallbackTitle = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    const candidates = parseReceiptDraftCandidates({
      receiptText,
      fallbackTitle
    });

    const draftIds: string[] = [];

    for (const candidate of candidates) {
      const draftPayload = receiptAdapter.buildDraft({
        candidate,
        fileName: file.name,
        notes: values.notes,
        extractionSource
      });
      const draftId = await createManualReviewDraft({
        sourceId,
        sourceType: draftPayload.sourceType,
        title: draftPayload.title,
        category: draftPayload.category,
        colour: draftPayload.colour,
        brand: draftPayload.brand,
        material: draftPayload.material,
        sourceLabel: draftPayload.sourceLabel,
        style: draftPayload.style,
        notes: draftPayload.notes,
        confidence: draftPayload.confidence,
        retailer: draftPayload.retailer,
        purchasePrice: draftPayload.purchasePrice,
        purchaseCurrency: draftPayload.purchaseCurrency,
        extractionSource: draftPayload.extractionSource,
        metadata: draftPayload.metadata,
        fieldConfidence: draftPayload.fieldConfidence,
        fieldProvenance: draftPayload.fieldProvenance
      });

      draftIds.push(draftId);

      if (draftPayload.purchasePrice !== null && draftPayload.purchasePrice !== undefined) {
        const priceMatches = await findGarmentPriceMatchCandidates({
          title: draftPayload.title ?? fallbackTitle,
          brand: draftPayload.brand,
          category: draftPayload.category
        }).catch(() => []);

        if (priceMatches.length >= 2) {
          await attachPriceMatchCandidates(draftId, priceMatches);
        }
      }
    }

    revalidatePath("/wardrobe/review");

    return {
      status: "success",
      draftIds,
      nextPath: "/wardrobe/review",
      message:
        !hasStrongReceiptText
          ? "Receipt draft created. Extraction was limited, so paste receipt text for stronger item, brand, and price matching."
          : draftIds.length > 1
            ? `${draftIds.length} receipt drafts created.`
            : "Receipt draft created."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not create receipt draft."
    };
  }
}

export async function addGarmentImageAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const file = formData.get("image");

    if (!(file instanceof File) || file.size === 0) {
      return {
        status: "error",
        message: "Choose an image file to upload."
      };
    }

    const uploadCheck = classifyUploadFile(file);
    if (uploadCheck !== "ok") {
      return {
        status: "error",
        errorCode: uploadCheck,
        message:
          uploadCheck === "unsupported_format"
            ? "That file type won't open. Garderobe reads JPEG, PNG and WEBP."
            : "That photo's too large. Photos over 20MB won't upload."
      };
    }

    const values = addGarmentImageFormSchema.parse({
      garment_id: formData.get("garment_id"),
      width: formData.get("width"),
      height: formData.get("height")
    });

    await addGarmentImage({
      garmentId: values.garment_id,
      file,
      width: values.width,
      height: values.height
    });

    revalidatePath("/wardrobe");

    return {
      status: "success",
      garmentId: values.garment_id,
      message: "Image attached."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to attach image."
    };
  }
}

export async function addGarment3dAssetAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const file = formData.get("asset_file");
    const values = addGarment3dAssetFormSchema.parse({
      garment_id: formData.get("garment_id"),
      asset_type: formData.get("asset_type"),
      source_type: formData.get("source_type"),
      file_format: formData.get("file_format"),
      material_name: formData.get("material_name"),
      fabric_weight: formData.get("fabric_weight"),
      stretch: formData.get("stretch"),
      drape: formData.get("drape"),
      notes: formData.get("notes")
    });

    await addGarment3dAsset({
      garmentId: values.garment_id,
      file: file instanceof File && file.size > 0 ? file : null,
      assetType: values.asset_type,
      sourceType: values.source_type,
      fileFormat: values.file_format,
      materialProfile: {
        name: values.material_name,
        fabric_weight: values.fabric_weight,
        stretch: values.stretch,
        drape: values.drape
      },
      physicsProfile: {
        fabric_weight: values.fabric_weight,
        stretch: values.stretch,
        drape: values.drape
      },
      rendererMetadata: {
        notes: values.notes
      }
    });

    revalidatePath("/wardrobe");

    return {
      status: "success",
      garmentId: values.garment_id,
      message: "3D asset saved."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save 3D asset."
    };
  }
}

function normalizeCategoryInput<
  T extends {
    category: string;
    subcategory?: string | null;
    extraction_metadata_json?: Record<string, unknown>;
  }
>(values: T): T {
  const normalized = normalizeCategoryParts(values.category);

  if (!normalized.primaryCategory) {
    return values;
  }

  const existingMetadata =
    values.extraction_metadata_json && typeof values.extraction_metadata_json === "object"
      ? values.extraction_metadata_json
      : {};

  return {
    ...values,
    category: normalized.primaryCategory,
    subcategory:
      values.subcategory?.trim() ||
      (normalized.descriptors.length ? normalized.descriptors.join(", ") : null),
    extraction_metadata_json: {
      ...existingMetadata,
      category_descriptors: normalized.descriptors
    }
  };
}

function normalizeCategoryParts(value: string | null | undefined) {
  const tokens = (value ?? "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (!tokens.length) {
    return { primaryCategory: null, descriptors: [] as string[] };
  }

  return {
    primaryCategory: tokens[tokens.length - 1] ?? null,
    descriptors: tokens.slice(0, -1)
  };
}

function shouldAttemptReceiptOcr(file: File) {
  return (
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export async function updateGarmentAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = normalizeCategoryInput(
      updateGarmentFormSchema.parse({
      garment_id: formData.get("garment_id"),
      title: formData.get("title"),
      brand: formData.get("brand"),
      category: formData.get("category"),
      subcategory: formData.get("subcategory"),
      material: formData.get("material"),
      size: formData.get("size"),
      fit: formData.get("fit"),
      formality_level: formData.get("formality_level"),
      purchase_currency: formData.get("purchase_currency"),
      purchase_price: formData.get("purchase_price"),
      purchase_date: formData.get("purchase_date"),
      retailer: formData.get("retailer"),
      primary_colour_family: formData.get("primary_colour_family"),
      seasonality: formData.getAll("seasonality")
      })
    );

    await updateGarment(values.garment_id, values, {
      primaryColourFamily: values.primary_colour_family as WardrobeColourFamily | null | undefined
    });

    revalidatePath("/wardrobe");

    return {
      status: "success",
      garmentId: values.garment_id,
      message: "Item updated."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to update item."
    };
  }
}

export async function logWearAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = logWearFormSchema.parse({
      garment_id: formData.get("garment_id"),
      entry_mode: formData.get("entry_mode"),
      wears_to_add: formData.get("wears_to_add"),
      worn_at: formData.get("worn_at"),
      occasion: formData.get("occasion"),
      notes: formData.get("notes")
    });

    if (values.entry_mode === "quick") {
      await incrementWearCount({
        garmentId: values.garment_id,
        wearsToAdd: values.wears_to_add
      });
    } else {
      await logWearEvent(values);
    }
    revalidatePath("/wardrobe");

    return {
      status: "success",
      garmentId: values.garment_id,
      message:
        values.entry_mode === "quick"
          ? `${values.wears_to_add} wear${values.wears_to_add === 1 ? "" : "s"} added.`
          : "Wear event saved."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save wear event."
    };
  }
}

export async function deleteGarmentAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = deleteGarmentFormSchema.parse({
      garment_id: formData.get("garment_id")
    });

    const blockers = await getGarmentUsageBlockers(values.garment_id);
    if (blockers.activeOutfitCount > 0 || blockers.activeListingId) {
      return {
        status: "blocked",
        garmentId: values.garment_id,
        message: "This piece is used elsewhere. Archive it instead of deleting it.",
        blocked: blockers
      };
    }

    await deleteGarment(values.garment_id);
    revalidatePath("/wardrobe");

    return {
      status: "success",
      message: "Item deleted. You can restore it from recently deleted."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to delete item."
    };
  }
}

export async function restoreGarmentAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = deleteGarmentFormSchema.parse({
      garment_id: formData.get("garment_id")
    });

    await restoreGarment(values.garment_id);
    revalidatePath("/wardrobe");

    return {
      status: "success",
      garmentId: values.garment_id,
      message: "Restored to the wardrobe."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to restore item."
    };
  }
}

export async function bulkDeleteGarmentsAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = bulkGarmentIdsFormSchema.parse({
      garment_id: formData.getAll("garment_id")
    });

    const blocked: string[] = [];
    for (const garmentId of values.garment_id) {
      const blockers = await getGarmentUsageBlockers(garmentId);
      if (blockers.activeOutfitCount > 0 || blockers.activeListingId) {
        blocked.push(garmentId);
        continue;
      }
      await deleteGarment(garmentId);
    }

    revalidatePath("/wardrobe");

    const deletedCount = values.garment_id.length - blocked.length;
    return {
      status: blocked.length ? "partial" : "success",
      message: blocked.length
        ? `${deletedCount} deleted. ${blocked.length} used elsewhere and were skipped.`
        : `${deletedCount} item${deletedCount === 1 ? "" : "s"} deleted. You can restore from recently deleted.`
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to delete items."
    };
  }
}

/**
 * 18a / w6c — "merge these two": the source's wear history moves to the
 * target (wear_count/cost_per_wear are trigger-derived from wear_events,
 * so reassigning wear_events.garment_id recomputes both automatically),
 * then the source is soft-deleted with merged_into_id set for the audit trail.
 */
export async function mergeGarmentsAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = mergeGarmentsFormSchema.parse({
      source_garment_id: formData.get("source_garment_id"),
      target_garment_id: formData.get("target_garment_id")
    });

    await mergeGarments(values.source_garment_id, values.target_garment_id);
    revalidatePath("/wardrobe");
    revalidatePath(`/wardrobe/${values.target_garment_id}`);

    return {
      status: "success",
      garmentId: values.target_garment_id,
      message: "Merged into one piece."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to merge these pieces."
    };
  }
}

export async function updateWearEventAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = updateWearEventFormSchema.parse({
      wear_event_id: formData.get("wear_event_id"),
      worn_at: formData.get("worn_at"),
      occasion: formData.get("occasion"),
      notes: formData.get("notes")
    });

    await updateWearEvent({
      wearEventId: values.wear_event_id,
      wornAt: values.worn_at ?? undefined,
      occasion: values.occasion,
      notes: values.notes
    });
    revalidatePath("/wardrobe");

    return { status: "success", message: "Wear updated." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to update that wear."
    };
  }
}

export async function deleteWearEventAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = deleteWearEventFormSchema.parse({
      wear_event_id: formData.get("wear_event_id")
    });

    await deleteWearEvent(values.wear_event_id);
    revalidatePath("/wardrobe");

    return { status: "success", message: "Wear removed." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to remove that wear."
    };
  }
}

export async function createCollectionAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = createCollectionFormSchema.parse({
      name: formData.get("name"),
      garment_id: formData.getAll("garment_id")
    });

    await createCollection({ name: values.name, garmentIds: values.garment_id });
    revalidatePath("/wardrobe");

    return { status: "success", message: "Collection created." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to create the collection."
    };
  }
}

export async function renameCollectionAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = renameCollectionFormSchema.parse({
      collection_id: formData.get("collection_id"),
      name: formData.get("name")
    });

    await renameCollection({ collectionId: values.collection_id, name: values.name });
    revalidatePath("/wardrobe");

    return { status: "success", message: "Collection renamed." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to rename the collection."
    };
  }
}

export async function deleteCollectionAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = deleteCollectionFormSchema.parse({
      collection_id: formData.get("collection_id")
    });

    await deleteCollection(values.collection_id);
    revalidatePath("/wardrobe");

    return { status: "success", message: "Collection deleted. The pieces stay in your wardrobe." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to delete the collection."
    };
  }
}

export async function setAvailabilityAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = setAvailabilityFormSchema.parse({
      garment_id: formData.get("garment_id"),
      availability: formData.get("availability")
    });

    await setGarmentAvailability(values.garment_id, values.availability);
    revalidatePath("/wardrobe");
    revalidatePath(`/wardrobe/${values.garment_id}`);

    return {
      status: "success",
      garmentId: values.garment_id,
      message: `Marked ${values.availability}.`
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to update availability."
    };
  }
}

export async function setSeasonalStorageAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = setSeasonalStorageFormSchema.parse({
      garment_id: formData.get("garment_id"),
      stored: formData.get("stored")
    });
    const stored = values.stored === "true";

    await setGarmentSeasonalStorage(values.garment_id, stored);
    revalidatePath("/wardrobe");
    revalidatePath(`/wardrobe/${values.garment_id}`);

    return {
      status: "success",
      garmentId: values.garment_id,
      message: stored
        ? "Stored for the season. It still counts in your wardrobe."
        : "Back in the everyday wardrobe."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to update seasonal storage."
    };
  }
}

export async function addToLetGoAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = addToLetGoFormSchema.parse({
      garment_id: formData.get("garment_id"),
      reason: formData.get("reason"),
      estimate_cents: formData.get("estimate_cents")
    });

    await addGarmentToLetGo({
      garmentId: values.garment_id,
      reason: values.reason,
      estimateCents: values.estimate_cents
    });
    revalidatePath("/wardrobe");
    revalidatePath("/wardrobe/let-go");
    revalidatePath(`/wardrobe/${values.garment_id}`);

    return {
      status: "success",
      garmentId: values.garment_id,
      message: "Added to the let-go list."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to add to the let-go list."
    };
  }
}

export async function removeFromLetGoAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = removeFromLetGoFormSchema.parse({
      garment_id: formData.get("garment_id")
    });

    await removeGarmentFromLetGo(values.garment_id);
    revalidatePath("/wardrobe");
    revalidatePath("/wardrobe/let-go");
    revalidatePath(`/wardrobe/${values.garment_id}`);

    return {
      status: "success",
      garmentId: values.garment_id,
      message: "Kept in the wardrobe."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to update the let-go list."
    };
  }
}

export async function archiveGarmentAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = archiveGarmentFormSchema.parse({
      garment_id: formData.get("garment_id"),
      reason: formData.get("reason")
    });

    await archiveGarment(values.garment_id, values.reason);
    revalidatePath("/wardrobe");
    revalidatePath("/wardrobe/let-go");

    return {
      status: "success",
      garmentId: values.garment_id,
      message: "Let go. You can undo this from the wardrobe.",
      nextPath: "/wardrobe"
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to let this piece go."
    };
  }
}

/** Plain callable, not FormData-based — bound to a toast's undo action. */
export async function undoArchiveGarmentAction(garmentId: string): Promise<void> {
  await unarchiveGarment(garmentId);
  revalidatePath("/wardrobe");
  revalidatePath(`/wardrobe/${garmentId}`);
}

export async function setPriceManuallyAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = setPriceManuallyFormSchema.parse({
      garment_id: formData.get("garment_id"),
      price: formData.get("price"),
      currency: formData.get("currency")
    });

    await setGarmentPriceManually({
      garmentId: values.garment_id,
      priceCents: Math.round(values.price * 100),
      currency: values.currency
    });
    revalidatePath("/wardrobe");
    revalidatePath(`/wardrobe/${values.garment_id}`);

    return {
      status: "success",
      garmentId: values.garment_id,
      message: "Price saved."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save the price."
    };
  }
}

export async function setGarmentFeatureImageAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = setFeatureImageFormSchema.parse({
      garment_id: formData.get("garment_id"),
      image_id: formData.get("image_id")
    });

    await setGarmentFeatureImage({
      garmentId: values.garment_id,
      imageId: values.image_id
    });

    revalidatePath("/wardrobe");

    return {
      status: "success",
      message: "Feature image updated."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not update feature image."
    };
  }
}

export async function toggleGarmentFavouriteAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = deleteGarmentFormSchema.parse({
      garment_id: formData.get("garment_id")
    });

    await toggleGarmentFavourite(values.garment_id);
    revalidatePath("/wardrobe");

    return {
      status: "success",
      garmentId: values.garment_id,
      message: "Favourite updated."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to update favourite."
    };
  }
}

const analyzePipelineFormSchema = z.object({
  source_id: z.string().uuid()
});

export async function analyzePipelineAction(
  _previousState: WardrobeActionState,
  formData: FormData
): Promise<WardrobeActionState> {
  try {
    const values = analyzePipelineFormSchema.parse({
      source_id: formData.get("source_id")
    });

    const response = await fetch("/api/pipeline/analyse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: values.source_id })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `Pipeline error: ${response.status}`);
    }

    const { draftIds, garmentCount } = await response.json() as {
      draftIds: string[];
      garmentCount: number;
    };

    revalidatePath("/wardrobe");

    return {
      status: "success",
      message:
        garmentCount === 0
          ? "No garments detected in photo."
          : `${garmentCount} garment${garmentCount === 1 ? "" : "s"} detected. Review drafts to add them.`,
      draftIds
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Pipeline analysis failed."
    };
  }
}
