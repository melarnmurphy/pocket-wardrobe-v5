"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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

export async function createStyleRuleAction(formData: FormData) {
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
}

export async function updateStyleRuleAction(formData: FormData) {
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
}

export async function deleteStyleRuleAction(formData: FormData) {
  const id = z.string().uuid().parse(formData.get("id"));
  await deleteUserStyleRule(id);
  revalidatePath("/style-rules");
}
