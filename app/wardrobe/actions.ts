"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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
