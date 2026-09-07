"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  avatarMeasurementSetSchema,
  avatarLayoutSchema,
  type AvatarMeasurementSetInput,
  type AvatarLayout
} from "@/lib/domain/avatar";
import {
  generateAvatarFromReferencePhotos,
  saveAvatarMeasurementSet,
  saveAvatarLayout,
  uploadAvatarPhoto
} from "@/lib/domain/avatar/service";

const avatarPhotoSchema = z.object({
  file: z.instanceof(File).refine((file) => file.size > 0, "Choose an avatar photo."),
}).superRefine((value, context) => {
  if (!value.file.type.startsWith("image/")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Avatar photo must be an image."
    });
  }

  if (value.file.size > 8 * 1024 * 1024) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Avatar photo must be 8 MB or smaller."
    });
  }
});

const avatarReferencePhotosSchema = z.object({
  files: z
    .array(z.instanceof(File))
    .min(2, "Choose at least two reference photos.")
    .max(5, "Use five reference photos or fewer.")
}).superRefine((value, context) => {
  value.files.forEach((file, index) => {
    if (file.size <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Reference photo ${index + 1} is empty.`
      });
    }

    if (!file.type.startsWith("image/")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Reference photo ${index + 1} must be an image.`
      });
    }

    if (file.size > 8 * 1024 * 1024) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Reference photo ${index + 1} must be 8 MB or smaller.`
      });
    }
  });
});

export type AvatarActionResult =
  | {
      status: "success";
      avatarUrl: string | null;
      layout: AvatarLayout;
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

export type AvatarMeasurementActionResult =
  | {
      status: "success";
      measurement: Awaited<ReturnType<typeof saveAvatarMeasurementSet>>;
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

export async function uploadAvatarPhotoAction(formData: FormData): Promise<AvatarActionResult> {
  try {
    const values = avatarPhotoSchema.parse({
      file: formData.get("avatar")
    });
    const profile = await uploadAvatarPhoto(values.file);

    revalidatePath("/wardrobe");

    return {
      status: "success",
      avatarUrl: profile.avatar_url,
      layout: profile.layout_json,
      message: "Avatar photo saved."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not save avatar photo."
    };
  }
}

export async function generateAvatarPhotoAction(formData: FormData): Promise<AvatarActionResult> {
  try {
    const values = avatarReferencePhotosSchema.parse({
      files: formData
        .getAll("references")
        .filter((file): file is File => file instanceof File && file.size > 0)
    });
    const profile = await generateAvatarFromReferencePhotos(values.files);

    revalidatePath("/wardrobe");

    return {
      status: "success",
      avatarUrl: profile.avatar_url,
      layout: profile.layout_json,
      message: "Digital twin avatar generated."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not generate avatar."
    };
  }
}

export async function saveAvatarLayoutAction(formData: FormData): Promise<AvatarActionResult> {
  try {
    const rawLayout = formData.get("layout_json");
    const parsedJson = typeof rawLayout === "string" ? JSON.parse(rawLayout) : {};
    const layout = avatarLayoutSchema.parse(parsedJson);
    const profile = await saveAvatarLayout(layout);

    revalidatePath("/wardrobe");

    return {
      status: "success",
      avatarUrl: profile.avatar_url,
      layout: profile.layout_json,
      message: "Avatar layout saved."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not save avatar layout."
    };
  }
}

export async function saveAvatarMeasurementsAction(
  formData: FormData
): Promise<AvatarMeasurementActionResult> {
  try {
    const values = avatarMeasurementSetSchema.parse({
      measurement_system: measurementSystemValue(formData.get("measurement_system")),
      capture_method: "manual",
      source_type: "user_reported",
      confidence: 1,
      status: "active",
      body_measurements_json: buildBodyMeasurements(formData),
      shape_profile_json: {
        silhouette: textValue(formData.get("silhouette")),
        posture_notes: textValue(formData.get("posture_notes")),
        fit_priorities: textValue(formData.get("fit_priorities"))
          ?.split(",")
          .map((value) => value.trim())
          .filter(Boolean) ?? []
      },
      skin_tone_json: {
        hex: textValue(formData.get("skin_tone_hex")),
        undertone: skinUndertoneValue(formData.get("skin_undertone")),
        fitzpatrick_type: numericValue(formData.get("fitzpatrick_type")),
        confidence: textValue(formData.get("skin_tone_hex")) ? 1 : undefined
      }
    } satisfies AvatarMeasurementSetInput);
    const measurement = await saveAvatarMeasurementSet(values);

    revalidatePath("/wardrobe");

    return {
      status: "success",
      measurement,
      message: "Avatar measurements saved."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not save avatar measurements."
    };
  }
}

function buildBodyMeasurements(formData: FormData) {
  const unit = formData.get("measurement_system") === "imperial" ? "in" : "cm";
  const measurementKeys = [
    "height",
    "shoulder_width",
    "chest",
    "bust",
    "waist",
    "hip",
    "inseam",
    "arm_length",
    "neck"
  ];

  return Object.fromEntries(
    measurementKeys.flatMap((key) => {
      const value = numericValue(formData.get(key));
      return value == null ? [] : [[key, { value, unit }]];
    })
  );
}

function numericValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function measurementSystemValue(value: FormDataEntryValue | null) {
  return value === "imperial" ? "imperial" : "metric";
}

function skinUndertoneValue(value: FormDataEntryValue | null) {
  if (value === "warm" || value === "cool" || value === "neutral") {
    return value;
  }

  return undefined;
}

function textValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}
