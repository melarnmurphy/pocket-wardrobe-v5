import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { styleRuleSchema } from "@/lib/domain/style-rules";
import type { Tables, TablesInsert } from "@/types/database";

type StyleRuleRow = Tables<"style_rules">;
type StyleRuleInsert = TablesInsert<"style_rules">;
const timestampSchema = z.string().min(1);

const styleRuleListSchema = styleRuleSchema.extend({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  created_at: timestampSchema
});

const createUserStyleRuleSchema = styleRuleSchema.omit({
  id: true,
  user_id: true,
  rule_scope: true
});

const updateUserStyleRuleSchema = createUserStyleRuleSchema;

export type StyleRuleListItem = z.infer<typeof styleRuleListSchema>;

export async function listStyleRules(): Promise<StyleRuleListItem[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("style_rules")
    .select(
      "id,rule_type,subject_type,subject_value,predicate,object_type,object_value,weight,rule_scope,user_id,explanation,active,created_at"
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
) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsed = createUserStyleRuleSchema.parse(input);
  const payload: StyleRuleInsert = {
    ...parsed,
    rule_scope: "user",
    user_id: user.id
  };

  const { data, error } = await supabase
    .from("style_rules")
    .insert(payload as never)
    .select(
      "id,rule_type,subject_type,subject_value,predicate,object_type,object_value,weight,rule_scope,user_id,explanation,active,created_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return styleRuleListSchema.parse(data);
}

export async function updateUserStyleRule(
  ruleId: string,
  input: z.input<typeof updateUserStyleRuleSchema>
) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(ruleId);
  const payload = updateUserStyleRuleSchema.parse(input);

  const { data, error } = await supabase
    .from("style_rules")
    .update(payload as never)
    .eq("id", parsedId)
    .eq("rule_scope", "user")
    .eq("user_id", user.id)
    .select(
      "id,rule_type,subject_type,subject_value,predicate,object_type,object_value,weight,rule_scope,user_id,explanation,active,created_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return styleRuleListSchema.parse(data);
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
