import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { computeUserTrendMatches } from "./matching";
import {
  trendSignalSchema,
  trendColourSchema,
  userTrendMatchSchema,
  type TrendSignalWithColour,
  type UserTrendMatch
} from "./index";
import { z } from "zod";
import type { TablesInsert } from "@/types/database";
import { getServerEnv } from "@/lib/env";

type UserTrendMatchInsert = TablesInsert<"user_trend_matches">;

const STALENESS_MS = 24 * 60 * 60 * 1000;

function buildGarmentEmbeddingText(garment: {
  title?: string | null;
  category?: string | null;
  subcategory?: string | null;
  material?: string | null;
  fit?: string | null;
  primary_colour_family?: string | null;
}): string {
  return [garment.title, garment.category, garment.subcategory, garment.material, garment.fit, garment.primary_colour_family]
    .filter(Boolean)
    .join(" ");
}

// Compatible relationship types — excludes contrast/clash types like high_contrast, warm_cool_balance
const COMPATIBLE_RELATIONSHIP_TYPES = [
  "complementary",
  "analogous",
  "split_complementary",
  "tonal",
  "neutral_pairing"
];

export async function getTrendSignals(): Promise<TrendSignalWithColour[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trend_signals")
    .select(
      "id,trend_type,label,normalized_attributes_json,season,year,region,source_count,authority_score,recency_score,confidence_score,first_seen_at,last_seen_at,created_at"
    )
    .order("last_seen_at", { ascending: false });

  if (error) throw new Error(error.message);

  const signals = z.array(trendSignalSchema).parse(data ?? []);

  const colourSignalIds = signals
    .filter((s) => s.trend_type === "colour")
    .map((s) => s.id as string);

  const colourById = new Map<string, z.infer<typeof trendColourSchema>>();

  if (colourSignalIds.length > 0) {
    const { data: colours, error: colourError } = await supabase
      .from("trend_colours")
      .select(
        "id,trend_signal_id,colour_id,source_name,source_label,source_url,canonical_hex,canonical_rgb,canonical_lab,canonical_lch,family,undertone,saturation_band,lightness_band,importance_score,observed_at,created_at"
      )
      .in("trend_signal_id", colourSignalIds);

    if (colourError) throw new Error(colourError.message);

    for (const c of z.array(trendColourSchema).parse(colours ?? [])) {
      colourById.set(c.trend_signal_id, c);
    }
  }

  return signals.map((s) => ({
    ...s,
    trend_colour: colourById.get(s.id as string) ?? null
  }));
}

async function getCompatibleColourFamilies(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Map<string, Set<string>>> {
  const { data: colours } = await supabase.from("colours").select("id,family");

  const { data: relationships } = await supabase
    .from("colour_relationships")
    .select("colour_id_a,colour_id_b,relationship_type")
    .in("relationship_type", COMPATIBLE_RELATIONSHIP_TYPES);

  const colourFamilyById = new Map<string, string>();
  for (const c of (colours ?? []) as { id: string; family: string }[]) {
    colourFamilyById.set(c.id, c.family);
  }

  const compatible = new Map<string, Set<string>>();
  for (const rel of (relationships ?? []) as { colour_id_a: string; colour_id_b: string }[]) {
    const familyA = colourFamilyById.get(rel.colour_id_a);
    const familyB = colourFamilyById.get(rel.colour_id_b);
    if (!familyA || !familyB) continue;

    if (!compatible.has(familyA)) compatible.set(familyA, new Set());
    if (!compatible.has(familyB)) compatible.set(familyB, new Set());
    compatible.get(familyA)!.add(familyB);
    compatible.get(familyB)!.add(familyA);
  }

  return compatible;
}

async function getSemanticUpgrades(
  supabase: Awaited<ReturnType<typeof createClient>>,
  garments: Array<{ id?: string; title?: string | null; category?: string | null; subcategory?: string | null; material?: string | null; fit?: string | null; primary_colour_family?: string | null }>,
  existingMatches: UserTrendMatch[]
): Promise<UserTrendMatch[]> {
  // Only upgrade signals currently classified as missing_piece
  const missingPieceSignalIds = new Set(
    existingMatches
      .filter((m) => m.match_type === "missing_piece")
      .map((m) => m.trend_signal_id)
  );

  if (missingPieceSignalIds.size === 0) return [];

  const env = getServerEnv();
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  // Batch-embed all garments in one call
  const garmentTexts = garments.map(buildGarmentEmbeddingText);
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: garmentTexts
  });
  const garmentEmbeddings = response.data.map((d) => d.embedding);

  const upgrades: UserTrendMatch[] = [];

  for (let i = 0; i < garments.length; i++) {
    const embedding = garmentEmbeddings[i];
    if (!embedding) continue;

    // Query match_trend_signals RPC
    const { data: matches } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }).rpc("match_trend_signals", {
      query_embedding: embedding,
      match_threshold: 0.6,
      match_count: 10
    });

    if (!matches) continue;

    for (const match of matches as Array<{ id: string; trend_type: string; label: string; normalized_attributes_json: Record<string, unknown>; season: string | null; year: number | null; region: string | null; source_count: number; authority_score: number; confidence_score: number; last_seen_at: string; similarity: number }>) {
      if (!missingPieceSignalIds.has(match.id)) continue;

      const sim = match.similarity;
      if (sim < 0.6) continue;

      const matchType: UserTrendMatch["match_type"] = sim >= 0.75 ? "exact_match" : "adjacent_match";
      const score = sim >= 0.75 ? sim * 0.9 : sim * 0.8;

      upgrades.push({
        user_id: existingMatches[0]?.user_id ?? "",
        trend_signal_id: match.id,
        match_type: matchType,
        score: Math.round(score * 100) / 100,
        reasoning_json: { similarity: sim, method: "semantic" }
      });
    }
  }

  return upgrades;
}

function mergeMatches(base: UserTrendMatch[], upgrades: UserTrendMatch[]): UserTrendMatch[] {
  const byKey = new Map<string, UserTrendMatch>();

  for (const m of base) {
    byKey.set(m.trend_signal_id, m);
  }

  for (const u of upgrades) {
    const existing = byKey.get(u.trend_signal_id);
    // Higher score wins
    if (!existing || u.score > existing.score) {
      byKey.set(u.trend_signal_id, u);
    }
  }

  return Array.from(byKey.values());
}

export async function getUserTrendMatches(userId: string): Promise<UserTrendMatch[]> {
  const supabase = await createClient();

  // Staleness gate: max(created_at) across user's existing matches
  const { data: latestMatch } = await supabase
    .from("user_trend_matches")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isStale =
    !latestMatch ||
    Date.now() - new Date((latestMatch as { created_at: string }).created_at).getTime() > STALENESS_MS;

  if (!isStale) {
    const { data: cached, error } = await supabase
      .from("user_trend_matches")
      .select("id,user_id,trend_signal_id,match_type,score,reasoning_json,created_at")
      .eq("user_id", userId)
      .order("score", { ascending: false });

    if (error) throw new Error(error.message);
    return z.array(userTrendMatchSchema).parse(cached ?? []);
  }

  const [signals, garments, compatibleColourFamilies] = await Promise.all([
    getTrendSignals(),
    listWardrobeGarments(),
    getCompatibleColourFamilies(supabase)
  ]);

  const matches = computeUserTrendMatches({ signals, garments, compatibleColourFamilies });
  const matchesWithUser = matches.map((m) => ({ ...m, user_id: userId }));

  const semanticUpgrades = await getSemanticUpgrades(supabase, garments, matchesWithUser);
  const finalMatches = mergeMatches(matchesWithUser, semanticUpgrades);

  await upsertUserTrendMatches(userId, finalMatches);

  return z.array(userTrendMatchSchema).parse(finalMatches);
}

export async function upsertUserTrendMatches(
  userId: string,
  matches: UserTrendMatch[]
): Promise<void> {
  if (matches.length === 0) return;
  const supabase = await createClient();

  const inserts: UserTrendMatchInsert[] = matches.map((m) => ({
    user_id: userId,
    trend_signal_id: m.trend_signal_id,
    match_type: m.match_type,
    score: m.score,
    reasoning_json: m.reasoning_json as never
  }));

  const { error } = await supabase
    .from("user_trend_matches")
    .upsert(inserts as never, {
      onConflict: "user_id,trend_signal_id,match_type",
      ignoreDuplicates: false
    });

  if (error) throw new Error(`Failed to upsert trend matches: ${error.message}`);
}
