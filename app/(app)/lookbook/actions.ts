"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formActionState, type FormActionState } from "@/lib/ui/form-action-state";
import {
  createLookbookItem,
  createLookbookEntry,
  deleteLookbookItem,
  deleteLookbookEntry,
  updateLookbookEntry,
  updateLookbookItem
} from "@/lib/domain/lookbook/service";

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

const optionalUrl = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  },
  z.string().url().nullable().optional()
);

const splitTags = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const createLookbookEntryFormSchema = z.object({
  title: nullableText(200),
  description: nullableText(2000),
  source_type: z.enum([
    "manual",
    "uploaded_image",
    "editorial_reference",
    "wishlist",
    "ai_generated",
    "outfit_reference"
  ]),
  source_url: optionalUrl,
  image_path: nullableText(500),
  aesthetic_tags: z.array(z.string().trim().min(1)).default([]),
  occasion_tags: z.array(z.string().trim().min(1)).default([])
});

const deleteLookbookEntrySchema = z.object({
  id: z.string().uuid()
});

const createLookbookItemFormSchema = z
  .object({
    lookbook_entry_id: z.string().uuid(),
    garment_id: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
      z.string().uuid().nullable()
    ),
    role: nullableText(80),
    desired_title: nullableText(200),
    desired_category: nullableText(100),
    desired_notes: nullableText(1000)
  })
  .refine(
    (value) =>
      value.garment_id !== null ||
      value.desired_title !== null ||
      value.desired_category !== null ||
      value.desired_notes !== null,
    "Choose a garment or describe a missing piece."
  );

const deleteLookbookItemSchema = z.object({
  id: z.string().uuid()
});

function toActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

async function runCreateLookbookEntry(formData: FormData): Promise<FormActionState> {
  try {
    const file = formData.get("image");
    const values = createLookbookEntryFormSchema.parse({
      title: formData.get("title"),
      description: formData.get("description"),
      source_type: formData.get("source_type"),
      source_url: formData.get("source_url"),
      image_path: formData.get("image_path"),
      aesthetic_tags: splitTags(formData.get("aesthetic_tags")),
      occasion_tags: splitTags(formData.get("occasion_tags"))
    });

    await createLookbookEntry(
      values,
      file instanceof File && file.size > 0 ? file : undefined
    );
    revalidatePath("/lookbook");

    return {
      status: "success",
      message: "Lookbook entry saved."
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error, "Could not save lookbook entry.")
    };
  }
}

export async function createLookbookEntryAction(formData: FormData) {
  await runCreateLookbookEntry(formData);
}

export async function createLookbookEntryFormAction(
  _state: FormActionState = formActionState,
  formData?: FormData
): Promise<FormActionState> {
  if (!formData) {
    return formActionState;
  }

  return runCreateLookbookEntry(formData);
}

async function runDeleteLookbookEntry(formData: FormData): Promise<FormActionState> {
  try {
    const values = deleteLookbookEntrySchema.parse({
      id: formData.get("id")
    });

    await deleteLookbookEntry(values.id);
    revalidatePath("/lookbook");

    return {
      status: "success",
      message: "Lookbook entry deleted."
    } satisfies FormActionState;
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error, "Could not delete lookbook entry.")
    } satisfies FormActionState;
  }
}

export async function deleteLookbookEntryAction(formData: FormData) {
  await runDeleteLookbookEntry(formData);
}

export async function deleteLookbookEntryFormAction(
  _state: FormActionState = formActionState,
  formData?: FormData
): Promise<FormActionState> {
  if (!formData) {
    return formActionState;
  }

  return runDeleteLookbookEntry(formData);
}

async function runUpdateLookbookEntry(formData: FormData): Promise<FormActionState> {
  try {
    const id = z.string().uuid().parse(formData.get("id"));
    const values = createLookbookEntryFormSchema.parse({
      title: formData.get("title"),
      description: formData.get("description"),
      source_type: formData.get("source_type"),
      source_url: formData.get("source_url"),
      image_path: formData.get("image_path"),
      aesthetic_tags: splitTags(formData.get("aesthetic_tags")),
      occasion_tags: splitTags(formData.get("occasion_tags"))
    });

    await updateLookbookEntry(id, values);
    revalidatePath("/lookbook");

    return {
      status: "success",
      message: "Lookbook entry updated."
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error, "Could not update lookbook entry.")
    };
  }
}

export async function updateLookbookEntryAction(formData: FormData) {
  await runUpdateLookbookEntry(formData);
}

export async function updateLookbookEntryFormAction(
  _state: FormActionState = formActionState,
  formData?: FormData
): Promise<FormActionState> {
  if (!formData) {
    return formActionState;
  }

  return runUpdateLookbookEntry(formData);
}

async function runCreateLookbookItem(formData: FormData): Promise<FormActionState> {
  try {
    const values = createLookbookItemFormSchema.parse({
      lookbook_entry_id: formData.get("lookbook_entry_id"),
      garment_id: formData.get("garment_id"),
      role: formData.get("role"),
      desired_title: formData.get("desired_title"),
      desired_category: formData.get("desired_category"),
      desired_notes: formData.get("desired_notes")
    });

    await createLookbookItem({
      lookbook_entry_id: values.lookbook_entry_id,
      garment_id: values.garment_id,
      role: values.role,
      desired_item_json:
        values.garment_id === null
          ? {
              title: values.desired_title,
              category: values.desired_category,
              notes: values.desired_notes
            }
          : null
    });
    revalidatePath("/lookbook");

    return {
      status: "success",
      message: "Linked item added."
    } satisfies FormActionState;
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error, "Could not add linked item.")
    } satisfies FormActionState;
  }
}

export async function createLookbookItemAction(formData: FormData) {
  await runCreateLookbookItem(formData);
}

export async function createLookbookItemFormAction(
  _state: FormActionState = formActionState,
  formData?: FormData
): Promise<FormActionState> {
  if (!formData) {
    return formActionState;
  }

  return runCreateLookbookItem(formData);
}

async function runDeleteLookbookItem(formData: FormData): Promise<FormActionState> {
  try {
    const values = deleteLookbookItemSchema.parse({
      id: formData.get("id")
    });

    await deleteLookbookItem(values.id);
    revalidatePath("/lookbook");

    return {
      status: "success",
      message: "Linked item removed."
    } satisfies FormActionState;
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error, "Could not remove linked item.")
    } satisfies FormActionState;
  }
}

export async function deleteLookbookItemAction(formData: FormData) {
  await runDeleteLookbookItem(formData);
}

export async function deleteLookbookItemFormAction(
  _state: FormActionState = formActionState,
  formData?: FormData
): Promise<FormActionState> {
  if (!formData) {
    return formActionState;
  }

  return runDeleteLookbookItem(formData);
}

async function runUpdateLookbookItem(formData: FormData): Promise<FormActionState> {
  try {
    const id = z.string().uuid().parse(formData.get("id"));
    const values = createLookbookItemFormSchema.parse({
      lookbook_entry_id: formData.get("lookbook_entry_id"),
      garment_id: formData.get("garment_id"),
      role: formData.get("role"),
      desired_title: formData.get("desired_title"),
      desired_category: formData.get("desired_category"),
      desired_notes: formData.get("desired_notes")
    });

    await updateLookbookItem(id, {
      lookbook_entry_id: values.lookbook_entry_id,
      garment_id: values.garment_id,
      role: values.role,
      desired_item_json:
        values.garment_id === null
          ? {
              title: values.desired_title,
              category: values.desired_category,
              notes: values.desired_notes
            }
          : null
    });
    revalidatePath("/lookbook");

    return {
      status: "success",
      message: "Linked item updated."
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error, "Could not update linked item.")
    };
  }
}

export async function updateLookbookItemAction(formData: FormData) {
  await runUpdateLookbookItem(formData);
}

export async function updateLookbookItemFormAction(
  _state: FormActionState = formActionState,
  formData?: FormData
): Promise<FormActionState> {
  if (!formData) {
    return formActionState;
  }

  return runUpdateLookbookItem(formData);
}
