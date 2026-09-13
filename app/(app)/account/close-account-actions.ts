"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAccountClosureBlockers, closeUserAccount } from "@/lib/domain/account/service";
import type { AccountActionState } from "@/app/account/photos-actions";
import { userFacingError } from "@/lib/ui/user-facing-error";

export async function getCloseAccountBlockersAction() {
  return getAccountClosureBlockers();
}

const closeAccountFormSchema = z.object({
  confirmation: z.string().trim().toLowerCase()
});

export async function closeUserAccountAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const { confirmation } = closeAccountFormSchema.parse({
    confirmation: formData.get("confirmation") ?? ""
  });

  if (confirmation !== "close") {
    return { status: "error", message: 'Type "close" to confirm.' };
  }

  try {
    await closeUserAccount();
  } catch (error) {
    return {
      status: "error",
      message: userFacingError(error, "we couldn't close your account. try again.")
    };
  }

  redirect("/");
}
