"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredAdminUser } from "@/lib/admin";
import {
  resolveUserIdByEmail,
  setUserPasswordById,
  syncUserEntitlementsFromBillingEvent
} from "@/lib/domain/billing/service";

export type AdminEntitlementActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const adminEntitlementActionState: AdminEntitlementActionState = {
  status: "idle",
  message: null
};

export type AdminPasswordActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const adminPasswordActionState: AdminPasswordActionState = {
  status: "idle",
  message: null
};

const optionalUuid = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}, z.string().uuid().optional());

const optionalEmail = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}, z.string().email().optional());

const formSchema = z
  .object({
    user_id: optionalUuid,
    user_email: optionalEmail,
    plan_tier: z.enum(["free", "pro", "premium"])
  })
  .refine((value) => Boolean(value.user_id || value.user_email), {
    message: "Enter either a user ID or an email address.",
    path: ["user_id"]
  });

const passwordFormSchema = z
  .object({
    user_id: optionalUuid,
    user_email: optionalEmail,
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm_password: z.string().min(8, "Password must be at least 8 characters.")
  })
  .refine((value) => Boolean(value.user_id || value.user_email), {
    message: "Enter either a user ID or an email address.",
    path: ["user_id"]
  })
  .refine((value) => value.password === value.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"]
  });

export async function saveEntitlementAction(
  _previousState: AdminEntitlementActionState,
  formData: FormData
): Promise<AdminEntitlementActionState> {
  try {
    await getRequiredAdminUser();

    const values = formSchema.parse({
      user_id: formData.get("user_id"),
      user_email: formData.get("user_email"),
      plan_tier: formData.get("plan_tier")
    });
    const resolvedUserId = values.user_id ?? (await resolveUserIdByEmail(values.user_email!));

    await syncUserEntitlementsFromBillingEvent({
      user_id: resolvedUserId,
      plan_tier: values.plan_tier,
      billing_provider: "manual-admin"
    });

    revalidatePath("/admin/entitlements");

    return {
      status: "success",
      message: `Saved ${values.plan_tier} entitlements for ${values.user_email ?? resolvedUserId}.`
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not save entitlements."
    };
  }
}

export async function setUserPasswordAction(
  _previousState: AdminPasswordActionState,
  formData: FormData
): Promise<AdminPasswordActionState> {
  try {
    await getRequiredAdminUser();

    const values = passwordFormSchema.parse({
      user_id: formData.get("user_id"),
      user_email: formData.get("user_email"),
      password: formData.get("password"),
      confirm_password: formData.get("confirm_password")
    });

    const resolvedUserId = values.user_id ?? (await resolveUserIdByEmail(values.user_email!));
    const user = await setUserPasswordById(resolvedUserId, values.password);

    return {
      status: "success",
      message: `Password updated for ${user.email ?? values.user_email ?? resolvedUserId}.`
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not update password."
    };
  }
}
