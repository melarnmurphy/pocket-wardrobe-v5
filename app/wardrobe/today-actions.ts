"use server";

import { revalidatePath } from "next/cache";
import { saveOutfitInputSchema } from "@/lib/domain/outfits";
import { plannedForDateFromLocal } from "@/lib/domain/outfits/appeal";
import { saveOutfit } from "@/lib/domain/outfits/service";

function readJsonField(formData: FormData, key: string): unknown {
  const raw = formData.get(key);
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

export async function saveTodayOutfitAction(formData: FormData) {
  const localDate =
    typeof formData.get("local_date") === "string" ? formData.get("local_date") : "";
  const localHourRaw = formData.get("local_hour");
  const localHour =
    typeof localHourRaw === "string" ? Number.parseInt(localHourRaw, 10) : Number.NaN;

  if (typeof localDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(localDate) || Number.isNaN(localHour)) {
    throw new Error("Missing local date for calendar planning.");
  }

  const garmentsRaw = readJsonField(formData, "garments");
  const parsed = saveOutfitInputSchema.safeParse({
    title: formData.get("title") || "Today",
    occasion: formData.get("occasion") || null,
    dress_code: formData.get("dress_code") || null,
    planned_for: plannedForDateFromLocal(localDate, localHour),
    weather_context_json: readJsonField(formData, "weather_context_json"),
    explanation: formData.get("explanation") || null,
    explanation_json: readJsonField(formData, "explanation_json"),
    garments: garmentsRaw
  });

  if (!parsed.success) {
    throw new Error("Could not save today’s outfit.");
  }

  await saveOutfit(parsed.data);
  revalidatePath("/wardrobe");
  revalidatePath("/outfits");
  revalidatePath("/calendar");
}
