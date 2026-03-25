import { z } from "zod";

export const styleRuleSchema = z.object({
  id: z.string().uuid().optional(),
  rule_type: z.string().trim().min(1).max(100),
  subject_type: z.string().trim().min(1).max(100),
  subject_value: z.string().trim().min(1).max(200),
  predicate: z.string().trim().min(1).max(100),
  object_type: z.string().trim().min(1).max(100),
  object_value: z.string().trim().min(1).max(200),
  weight: z.number().min(0).max(100).default(1),
  rule_scope: z.enum(["global", "user"]).default("global"),
  user_id: z.string().uuid().nullable().optional(),
  explanation: z.string().trim().max(2000).nullable().optional(),
  active: z.boolean().default(true),
  constraint_type: z.enum(["hard", "soft"]).default("soft"),
});

export type StyleRule = z.infer<typeof styleRuleSchema>;
