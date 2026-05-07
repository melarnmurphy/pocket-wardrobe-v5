"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import {
  createGarment,
  addGarment3dAsset,
  addGarmentImage,
  deleteGarment,
  setGarmentFeatureImage,
  setGarmentPrimaryColourFamily,
  toggleGarmentFavourite,
  updateGarment
} from "@/lib/domain/wardrobe/service";
import {
  type WardrobeColourFamily
} from "@/lib/domain/wardrobe/colours";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";
import { incrementWearCount, logWearEvent } from "@/lib/domain/wear-events/service";
import {
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
    const { sourceId } = await createProductUrlSource({ url: values.product_url });
    const extracted = await extractProductMetadataFromUrl(values.product_url);
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
      metadata: draftMetadata
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
        metadata: draftPayload.metadata
      });

      draftIds.push(draftId);
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

    await deleteGarment(values.garment_id);
    revalidatePath("/wardrobe");

    return {
      status: "success",
      message: "Item deleted."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to delete item."
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
