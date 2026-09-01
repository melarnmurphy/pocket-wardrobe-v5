"use server";

import { revalidatePath } from "next/cache";
import { updateRadiusKm } from "@/lib/domain/profile/service";

export async function updateRadiusAction(
  radiusKm: number
): Promise<{ status: "success" } | { status: "error"; message: string }> {
  try {
    await updateRadiusKm(radiusKm);
    revalidatePath("/local/nearby");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save the radius."
    };
  }
}
