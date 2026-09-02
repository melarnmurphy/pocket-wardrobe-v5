import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";

export type SearchResult = {
  kind: "piece" | "look" | "trend" | "listing";
  id: string;
  title: string;
  meta: string | null;
  href: string;
};

const resultRowSchema = z.object({ id: z.string(), title: z.string().nullable() });

/**
 * w3c — ⌘K across pieces, looks, trends and nearby. Four independent
 * queries (garments/outfits are per-user; trend_signals is global;
 * local_listings is scoped to live rows, same RLS-visible set the nearby
 * feed already reads) rather than one federated query — the underlying
 * tables have no shared search index to join across.
 */
export async function globalSearch(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const user = await getRequiredUser();
  const supabase = await createClient();
  // PostgREST's .or() filter string treats ",()" as syntax, not literal
  // characters — strip them so a search term can't reshape the filter.
  const safeTerm = trimmed.replace(/[,()]/g, " ").trim();
  if (!safeTerm) return [];
  const like = `%${safeTerm}%`;

  const [garments, outfits, trends, listings] = await Promise.all([
    supabase
      .from("garments")
      .select("id,title,category")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .is("deleted_at", null)
      .or(`title.ilike.${like},category.ilike.${like},brand.ilike.${like}`)
      .limit(6),
    supabase
      .from("outfits")
      .select("id,title")
      .eq("user_id", user.id)
      .ilike("title", like)
      .limit(6),
    supabase.from("trend_signals").select("id,label,canonical_label").ilike("label", like).limit(6),
    supabase
      .from("local_listings")
      .select("id,description,suburb")
      .eq("status", "live")
      .ilike("description", like)
      .limit(6)
  ]);

  const results: SearchResult[] = [];

  for (const row of z.array(resultRowSchema.extend({ category: z.string().optional() })).parse(garments.data ?? [])) {
    results.push({
      kind: "piece",
      id: row.id,
      title: row.title || row.category || "a piece",
      meta: "your wardrobe",
      href: `/wardrobe/${row.id}`
    });
  }

  for (const row of z.array(resultRowSchema).parse(outfits.data ?? [])) {
    results.push({
      kind: "look",
      id: row.id,
      title: row.title || "a look",
      meta: "your looks",
      href: `/outfits/${row.id}`
    });
  }

  for (const row of z
    .array(z.object({ id: z.string(), label: z.string(), canonical_label: z.string().nullable() }))
    .parse(trends.data ?? [])) {
    results.push({
      kind: "trend",
      id: row.id,
      title: row.canonical_label || row.label,
      meta: "trends",
      href: `/trends/${row.id}`
    });
  }

  for (const row of z
    .array(z.object({ id: z.string(), description: z.string(), suburb: z.string() }))
    .parse(listings.data ?? [])) {
    results.push({
      kind: "listing",
      id: row.id,
      title: row.description,
      meta: `nearby · ${row.suburb}`,
      href: `/local/${row.id}`
    });
  }

  return results;
}
