"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateAccountProfile } from "@/lib/domain/account/service";

const updateAccountProfileSchema = z.object({
  preferred_location: z.string().trim().max(160).optional()
});

export type AccountProfileActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const accountProfileActionState: AccountProfileActionState = {
  status: "idle",
  message: null
};

export async function updateAccountProfileAction(
  _previousState: AccountProfileActionState,
  formData: FormData
): Promise<AccountProfileActionState> {
  try {
    const values = updateAccountProfileSchema.parse({
      preferred_location: formData.get("preferred_location") ?? undefined
    });

    await updateAccountProfile({
      preferred_location: values.preferred_location?.trim() || null
    });

    revalidatePath("/account");
    revalidatePath("/outfits");
    revalidatePath("/");

    return {
      status: "success",
      message: "Account details updated."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not update account details."
    };
  }
}
