"use server";

import { revalidatePath } from "next/cache";
import {
  generateOutfitInputSchema,
  saveOutfitInputSchema,
  type GeneratedOutfit
} from "@/lib/domain/outfits";
import {
  generateOutfitForUser,
  saveOutfit
} from "@/lib/domain/outfits/service";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { categoryToRole } from "@/lib/domain/outfits/generator";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";

/** Generate an outfit. `isPro` is false for this iteration. */
export async function generateOutfitAction(
  rawInput: unknown
): Promise<{ outfit: GeneratedOutfit } | { error: string }> {
  const parsed = generateOutfitInputSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.message };
  try {
    const outfit = await generateOutfitForUser(parsed.data, false);
    if (outfit.garments.length < 2) {
      return { error: "Not enough matching garments in your wardrobe. Try a different dress code or add more items." };
    }
    return { outfit };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Generation failed" };
  }
}

/** Return wardrobe garments in the same role as the given garment, excluding it. */
export async function getSwapCandidatesAction(
  role: string,
  excludeGarmentId: string
): Promise<GarmentListItem[]> {
  try {
    const garments = await listWardrobeGarments();
    return garments.filter(
      g => categoryToRole(g.category) === role && g.id !== excludeGarmentId
    );
  } catch {
    return [];
  }
}

/** Persist a generated outfit to the DB. */
export async function saveOutfitAction(
  rawInput: unknown
): Promise<{ id: string } | { error: string }> {
  const parsed = saveOutfitInputSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.message };
  try {
    const id = await saveOutfit(parsed.data);
    revalidatePath("/outfits");
    return { id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Save failed" };
  }
}
