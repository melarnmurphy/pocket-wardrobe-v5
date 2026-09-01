"use server";

import { revalidatePath } from "next/cache";
import {
  updateLocalPrivacy,
  updateProfile,
  updateSizes
} from "@/lib/domain/profile/service";

export type ProfileActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

const idle: ProfileActionState = { status: "idle", message: null };

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  try {
    await updateProfile({
      local_name: formData.get("local_name"),
      suburb: formData.get("suburb")
    } as never);
    revalidatePath("/account");
    return { status: "success", message: "Saved." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save."
    };
  }
}

export async function updateSizesAction(
  _previousState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  try {
    await updateSizes({
      tops_size: formData.get("tops_size"),
      bottoms_size: formData.get("bottoms_size"),
      shoes_size: formData.get("shoes_size"),
      tops_size_system: formData.get("tops_size_system") || "AU",
      bottoms_size_system: formData.get("bottoms_size_system") || "AU",
      shoes_size_system: formData.get("shoes_size_system") || "AU",
      height_cm: formData.get("height_cm") || null,
      one_size_either_way: formData.get("one_size_either_way") === "on"
    } as never);
    revalidatePath("/account");
    return { status: "success", message: "Sizes saved." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save sizes."
    };
  }
}

export async function updateLocalPrivacyAction(
  _previousState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  try {
    await updateLocalPrivacy({
      show_suburb: formData.get("show_suburb") === "on",
      show_wear_count: formData.get("show_wear_count") === "on"
    });
    revalidatePath("/account");
    return { status: "success", message: "Privacy settings saved." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save privacy settings."
    };
  }
}

export { idle as idleProfileActionState };
