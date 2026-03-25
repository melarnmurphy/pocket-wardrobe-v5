"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formActionState, type FormActionState } from "@/lib/ui/form-action-state";
import {
  createUserStyleRule,
  deleteUserStyleRule,
  updateUserStyleRule
} from "@/lib/domain/style-rules/service";

const nullableText = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    },
    z.string().max(max).nullable().optional()
  );

const styleRuleFormSchema = z.object({
  rule_type: z.string().trim().min(1).max(100),
  subject_type: z.string().trim().min(1).max(100),
  subject_value: z.string().trim().min(1).max(200),
  predicate: z.string().trim().min(1).max(100),
  object_type: z.string().trim().min(1).max(100),
  object_value: z.string().trim().min(1).max(200),
  weight: z.preprocess((value) => Number(value), z.number().min(0).max(100)),
  explanation: nullableText(2000),
  active: z.preprocess((value) => value === "on", z.boolean())
});

function toActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

async function runCreateStyleRule(formData: FormData): Promise<FormActionState> {
  try {
    const values = styleRuleFormSchema.parse({
      rule_type: formData.get("rule_type"),
      subject_type: formData.get("subject_type"),
      subject_value: formData.get("subject_value"),
      predicate: formData.get("predicate"),
      object_type: formData.get("object_type"),
      object_value: formData.get("object_value"),
      weight: formData.get("weight"),
      explanation: formData.get("explanation"),
      active: formData.get("active")
    });

    await createUserStyleRule(values);
    revalidatePath("/style-rules");

    return {
      status: "success",
      message: "User rule saved."
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error, "Could not save user rule.")
    };
  }
}

export async function createStyleRuleAction(formData: FormData) {
  await runCreateStyleRule(formData);
}

export async function createStyleRuleFormAction(
  _state: FormActionState = formActionState,
  formData?: FormData
): Promise<FormActionState> {
  if (!formData) {
    return formActionState;
  }

  return runCreateStyleRule(formData);
}

async function runUpdateStyleRule(formData: FormData): Promise<FormActionState> {
  try {
    const id = z.string().uuid().parse(formData.get("id"));
    const values = styleRuleFormSchema.parse({
      rule_type: formData.get("rule_type"),
      subject_type: formData.get("subject_type"),
      subject_value: formData.get("subject_value"),
      predicate: formData.get("predicate"),
      object_type: formData.get("object_type"),
      object_value: formData.get("object_value"),
      weight: formData.get("weight"),
      explanation: formData.get("explanation"),
      active: formData.get("active")
    });

    await updateUserStyleRule(id, values);
    revalidatePath("/style-rules");

    return {
      status: "success",
      message: "Rule updated."
    } satisfies FormActionState;
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error, "Could not update rule.")
    } satisfies FormActionState;
  }
}

export async function updateStyleRuleAction(formData: FormData) {
  await runUpdateStyleRule(formData);
}

export async function updateStyleRuleFormAction(
  _state: FormActionState = formActionState,
  formData?: FormData
): Promise<FormActionState> {
  if (!formData) {
    return formActionState;
  }

  return runUpdateStyleRule(formData);
}

async function runDeleteStyleRule(formData: FormData): Promise<FormActionState> {
  try {
    const id = z.string().uuid().parse(formData.get("id"));
    await deleteUserStyleRule(id);
    revalidatePath("/style-rules");

    return {
      status: "success",
      message: "Rule deleted."
    } satisfies FormActionState;
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error, "Could not delete rule.")
    } satisfies FormActionState;
  }
}

export async function deleteStyleRuleAction(formData: FormData) {
  await runDeleteStyleRule(formData);
}

export async function deleteStyleRuleFormAction(
  _state: FormActionState = formActionState,
  formData?: FormData
): Promise<FormActionState> {
  if (!formData) {
    return formActionState;
  }

  return runDeleteStyleRule(formData);
}
