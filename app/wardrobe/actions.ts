"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import {
  createGarment,
  addGarmentImage,
  deleteGarment,
  toggleGarmentFavourite,
  updateGarment
} from "@/lib/domain/wardrobe/service";
import type { WardrobeColourFamily } from "@/lib/domain/wardrobe/colours";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";
import { logWearEvent } from "@/lib/domain/wear-events/service";
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
  parseReceiptDraftCandidates,
  readReceiptTextFromFile
} from "@/lib/domain/ingestion/extractors";

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

const logWearFormSchema = z.object({
  garment_id: z.string().uuid(),
  worn_at: optionalTimestampInput,
  occasion: nullableText(120),
  notes: nullableText(2000)
});

const deleteGarmentFormSchema = z.object({
  garment_id: z.string().uuid()
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
    const values = createGarmentFormSchema.parse({
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
    });

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
    const extractedPrice =
      extracted.price && extracted.price.trim().length > 0
        ? Number(extracted.price.replace(/[^0-9.]+/g, ""))
        : null;
    const usedRetailerMetadata = Boolean(
      extracted.brand ||
        extracted.category ||
        extracted.price ||
        extracted.description ||
        (extracted.title && extracted.title !== titleHint)
    );
    const extractionSource = usedRetailerMetadata
      ? "retailer metadata"
      : values.title_hint
        ? "manual hint"
        : "URL fallback";
    const draftId = await createManualReviewDraft({
      sourceId,
      sourceType: "product_url",
      title: extracted.title || titleHint,
      category: extracted.category,
      colour: extracted.colour,
      brand: extracted.brand,
      material: null,
      sourceLabel: url.hostname,
      style: extracted.brand || extracted.retailer || "product link",
      notes: values.notes ?? (
        [extracted.description, extracted.price ? `Price: ${extracted.currency || ""} ${extracted.price}`.trim() : null]
          .filter(Boolean)
          .join(" · ") || `Added from ${url.hostname}`
      ),
      confidence: extracted.title || extracted.category ? 0.44 : 0.22,
      retailer: extracted.retailer,
      purchasePrice: Number.isFinite(extractedPrice) ? extractedPrice : null,
      purchaseCurrency: extracted.currency,
      extractionSource
    });

    revalidatePath("/wardrobe/review");

    return {
      status: "success",
      draftIds: [draftId],
      nextPath: "/wardrobe/review",
      message: "Product link draft created."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not create product-link draft."
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
      const draftId = await createManualReviewDraft({
        sourceId,
        sourceType: "receipt",
        title: candidate.title,
        category: candidate.category,
        colour: candidate.colour,
        brand: candidate.brand,
        sourceLabel: file.name,
        style: "receipt import",
        notes: values.notes ?? candidate.notes ?? "Review this receipt-derived draft.",
        confidence: candidate.confidence,
        retailer: candidate.retailer,
        purchasePrice: candidate.price,
        purchaseCurrency: candidate.currency,
        extractionSource
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
    const values = updateGarmentFormSchema.parse({
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
    });

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
      worn_at: formData.get("worn_at"),
      occasion: formData.get("occasion"),
      notes: formData.get("notes")
    });

    await logWearEvent(values);
    revalidatePath("/wardrobe");

    return {
      status: "success",
      garmentId: values.garment_id,
      message: "Wear event saved."
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
