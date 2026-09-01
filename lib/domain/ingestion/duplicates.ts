import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";

const matchSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  category: z.string(),
  similarity: z.coerce.number()
});

export type DuplicateMatch = z.infer<typeof matchSchema>;

/**
 * "Duplicate compare above 0.92 similarity, never a silent merge" — this
 * only surfaces a hint for the reviewer to look at; it never discards or
 * merges a draft on its own. See migration 025's match_garments_by_embedding.
 */
export async function findSimilarGarments(
  embedding: number[],
  threshold = 0.92
): Promise<DuplicateMatch | null> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = (await supabase.rpc("match_garments_by_embedding" as never, {
    query_embedding: embedding,
    match_user_id: user.id,
    match_threshold: threshold,
    match_count: 1
  } as never)) as { data: unknown; error: { message: string } | null };

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  return matchSchema.parse(data[0]);
}
