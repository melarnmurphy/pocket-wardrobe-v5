"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { saveOutfitInputSchema, type GeneratedOutfit } from "@/lib/domain/outfits";
import { plannedForDateFromLocal } from "@/lib/domain/outfits/appeal";
import { saveOutfit, listSavedOutfits } from "@/lib/domain/outfits/service";
import { suggestTodayOutfit } from "@/lib/domain/outfits/today";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";

/**
 * 12a — "the forecast decides the layers." Called from the client once a
 * location is known (browser geolocation, via /api/weather/local), so
 * weather feeds the suggestion instead of it always being weather-agnostic.
 */
export async function suggestTodayOutfitWithWeatherAction(
  weather: string
): Promise<{ outfit: GeneratedOutfit } | { error: string }> {
  const parsedWeather = z.string().trim().min(1).max(80).safeParse(weather);
  if (!parsedWeather.success) {
    return { error: "Missing weather." };
  }

  try {
    const [garments, styleRules, savedOutfits] = await Promise.all([
      listWardrobeGarments(),
      listStyleRules(),
      listSavedOutfits()
    ]);

    const nowMs = Date.now();
    const weekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
    const recentOutfitGarmentIds = savedOutfits.flatMap((outfit) => {
      const created = outfit.created_at ? Date.parse(outfit.created_at) : 0;
      if (Number.isNaN(created) || created < weekAgo) return [];
      return outfit.items.map((item) => item.garment_id);
    });

    const outfit = suggestTodayOutfit({
      garments,
      styleRules,
      recentOutfitGarmentIds,
      nowMs,
      weather: parsedWeather.data
    });

    return { outfit };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to check the weather." };
  }
}

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
