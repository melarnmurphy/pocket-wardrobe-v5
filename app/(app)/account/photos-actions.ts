"use server";

import { revalidatePath } from "next/cache";
import { deleteAllUserPhotos } from "@/lib/domain/account/service";
import { userFacingError } from "@/lib/ui/user-facing-error";

export type AccountActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export async function deleteAllUserPhotosAction(
  _previousState: AccountActionState,
  _formData: FormData
): Promise<AccountActionState> {
  try {
    const { deletedCount } = await deleteAllUserPhotos();
    revalidatePath("/account");
    revalidatePath("/wardrobe");

    return {
      status: "success",
      message:
        deletedCount > 0
          ? `Deleted ${deletedCount} photo${deletedCount === 1 ? "" : "s"}. Your pieces and their history stay.`
          : "There were no photos to delete."
    };
  } catch (error) {
    return {
      status: "error",
      message: userFacingError(error, "we couldn't delete your photos. try again.")
    };
  }
}
