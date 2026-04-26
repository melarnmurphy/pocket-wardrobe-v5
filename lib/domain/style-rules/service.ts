import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { styleRuleSchema } from "@/lib/domain/style-rules";
import {
  resolveStyleRuleValue,
  type SemanticSuggestionMatch,
  type SupportedStyleRuleValueType
} from "@/lib/domain/style-rules/semantic-matching";
import type { Tables, TablesInsert } from "@/types/database";

type StyleRuleRow = Tables<"style_rules">;
type StyleRuleInsert = TablesInsert<"style_rules">;
const timestampSchema = z.string().min(1);

const styleRuleListSchema = styleRuleSchema.extend({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  // constraint_type was added by migration 005 (knowledge-graph style rules).
  // It is optional here so existing rows without the column still parse cleanly.
  constraint_type: z.string().optional(),
  created_at: timestampSchema
});

const createUserStyleRuleSchema = styleRuleSchema.omit({
  id: true,
  user_id: true,
  rule_scope: true,
  constraint_type: true,
});

const updateUserStyleRuleSchema = createUserStyleRuleSchema;

export type StyleRuleListItem = z.infer<typeof styleRuleListSchema>;
export type StyleRuleSaveResult = {
  rule: StyleRuleListItem;
  normalizedFields: Array<{
    field: "subject_value" | "object_value";
    match: SemanticSuggestionMatch;
  }>;
};

function isSupportedStyleRuleValueType(value: string): value is SupportedStyleRuleValueType {
  return (
    value === "category" ||
    value === "colour" ||
    value === "colour_family" ||
    value === "occasion" ||
    value === "season"
  );
}

async function normalizeStyleRuleInput(
  input: z.input<typeof createUserStyleRuleSchema>
): Promise<{
  payload: z.infer<typeof createUserStyleRuleSchema>;
  normalizedFields: StyleRuleSaveResult["normalizedFields"];
}> {
  const parsed = createUserStyleRuleSchema.parse(input);
  const normalizedFields: StyleRuleSaveResult["normalizedFields"] = [];
  const payload = { ...parsed };

  const subjectMatch =
    isSupportedStyleRuleValueType(parsed.subject_type)
      ? await resolveStyleRuleValue({
          type: parsed.subject_type,
          input: parsed.subject_value
        }).catch(() => null)
      : null;
  if (subjectMatch && subjectMatch.resolved !== parsed.subject_value) {
    payload.subject_value = subjectMatch.resolved;
    normalizedFields.push({
      field: "subject_value",
      match: subjectMatch
    });
  }

  const objectMatch =
    isSupportedStyleRuleValueType(parsed.object_type)
      ? await resolveStyleRuleValue({
          type: parsed.object_type,
          input: parsed.object_value
        }).catch(() => null)
      : null;
  if (objectMatch && objectMatch.resolved !== parsed.object_value) {
    payload.object_value = objectMatch.resolved;
    normalizedFields.push({
      field: "object_value",
      match: objectMatch
    });
  }

  return { payload, normalizedFields };
}

export async function listStyleRules(): Promise<StyleRuleListItem[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("style_rules")
    .select(
      "id,rule_type,subject_type,subject_value,predicate,object_type,object_value,weight,rule_scope,user_id,explanation,active,constraint_type,created_at"
    )
    .or(`rule_scope.eq.global,user_id.eq.${user.id}`)
    .order("rule_scope", { ascending: true })
    .order("weight", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(styleRuleListSchema).parse((data ?? []) satisfies StyleRuleRow[]);
}

export async function createUserStyleRule(
  input: z.input<typeof createUserStyleRuleSchema>
): Promise<StyleRuleSaveResult> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const { payload: parsed, normalizedFields } = await normalizeStyleRuleInput(input);
  // constraint_type is not yet in the generated DB types — added by migration 005.
  // Cast through unknown until types are regenerated after migration is applied.
  const payload = {
    ...parsed,
    rule_scope: "user" as const,
    user_id: user.id,
    constraint_type: "soft" as const,
  } as unknown as StyleRuleInsert;

  const { data, error } = await supabase
    .from("style_rules")
    .insert(payload as never)
    .select(
      "id,rule_type,subject_type,subject_value,predicate,object_type,object_value,weight,rule_scope,user_id,explanation,active,constraint_type,created_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    rule: styleRuleListSchema.parse(data),
    normalizedFields
  };
}

export async function updateUserStyleRule(
  ruleId: string,
  input: z.input<typeof updateUserStyleRuleSchema>
): Promise<StyleRuleSaveResult> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(ruleId);
  const { payload, normalizedFields } = await normalizeStyleRuleInput(input);

  const { data, error } = await supabase
    .from("style_rules")
    .update(payload as never)
    .eq("id", parsedId)
    .eq("rule_scope", "user")
    .eq("user_id", user.id)
    .select(
      "id,rule_type,subject_type,subject_value,predicate,object_type,object_value,weight,rule_scope,user_id,explanation,active,constraint_type,created_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    rule: styleRuleListSchema.parse(data),
    normalizedFields
  };
}

export async function deleteUserStyleRule(ruleId: string) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(ruleId);

  const { error } = await supabase
    .from("style_rules")
    .delete()
    .eq("id", parsedId)
    .eq("rule_scope", "user")
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}
