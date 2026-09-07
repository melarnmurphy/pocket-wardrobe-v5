"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setOutfitPlannedDate } from "@/lib/domain/outfits/service";

export type CalendarActionResult =
  | { status: "success" }
  | { status: "error"; message: string };

const planSchema = z.object({
  outfitId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function planOutfitForDateAction(
  outfitId: string,
  date: string
): Promise<CalendarActionResult> {
  try {
    const parsed = planSchema.parse({ outfitId, date });
    await setOutfitPlannedDate({ outfitId: parsed.outfitId, date: parsed.date });
    revalidatePath("/calendar");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not plan outfit."
    };
  }
}

export async function unplanOutfitAction(
  outfitId: string
): Promise<CalendarActionResult> {
  try {
    const id = z.string().uuid().parse(outfitId);
    await setOutfitPlannedDate({ outfitId: id, date: null });
    revalidatePath("/calendar");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not remove plan."
    };
  }
}
