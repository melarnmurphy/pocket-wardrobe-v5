import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { computeUserTrendMatches } from "./matching";
import {
  trendSignalSchema,
  trendColourSchema,
  trendSourceSchema,
  trendEntitySchema,
  trendSignalMetricSchema,
  userTrendMatchSchema,
  trendStorySchema,
  type TrendSignalWithColour,
  type UserTrendMatch,
  type TrendStory
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
      "id,trend_type,label,canonical_label,vertical,family,subfamily,micro_signal,normalized_attributes_json,season,year,region,source_count,authority_score,recency_score,confidence_score,trend_status,trend_confidence,score_30d_delta,first_seen_at,last_seen_at,created_at"
    )
    .order("last_seen_at", { ascending: false });

  if (error) throw new Error(error.message);

  const signals = z.array(trendSignalSchema).parse(data ?? []);

  const colourSignalIds = signals
    .filter((s) => s.trend_type === "colour")
    .map((s) => s.id as string);

  const colourById = new Map<string, z.infer<typeof trendColourSchema>>();
  const sourcesBySignalId = new Map<string, z.infer<typeof trendSourceSchema>[]>();
  const entitiesBySignalId = new Map<string, z.infer<typeof trendEntitySchema>[]>();
  const metricsBySignalId = new Map<string, z.infer<typeof trendSignalMetricSchema>[]>();

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

  const signalIds = signals.map((signal) => signal.id as string).filter(Boolean);

  if (signalIds.length > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const { data: sourceLinks, error: sourceError } = await supabase
      .from("trend_signal_sources")
      .select(
        "trend_signal_id, trend_source:trend_sources(id,source_name,source_type,source_url,title,publish_date,author,region,season,raw_text_excerpt,ingestion_timestamp)"
      )
      .in("trend_signal_id", signalIds);

    if (sourceError) {
      throw new Error(sourceError.message);
    }

    for (const row of (sourceLinks ?? []) as Array<{
      trend_signal_id: string;
      trend_source: unknown;
    }>) {
      const parsedSource = trendSourceSchema.safeParse(row.trend_source);
      if (!parsedSource.success) {
        continue;
      }

      const existingSources = sourcesBySignalId.get(row.trend_signal_id) ?? [];
      existingSources.push(parsedSource.data);
      sourcesBySignalId.set(row.trend_signal_id, existingSources);
    }

    const { data: entities, error: entityError } = await supabase
      .from("trend_entities")
      .select(
        "id,trend_signal_id,entity_type,label,normalized_label,brand,source_count,first_seen_at,last_seen_at,metadata_json,created_at"
      )
      .in("trend_signal_id", signalIds)
      .order("source_count", { ascending: false });

    if (entityError) {
      throw new Error(entityError.message);
    }

    for (const entity of z.array(trendEntitySchema).parse(entities ?? [])) {
      const existingEntities = entitiesBySignalId.get(entity.trend_signal_id) ?? [];
      existingEntities.push(entity);
      entitiesBySignalId.set(entity.trend_signal_id, existingEntities);
    }

    const { data: metrics, error: metricError } = await supabase
      .from("trend_signal_metrics")
      .select(
        "id,trend_signal_id,metric_date,search_interest,search_velocity,editorial_mentions,editorial_source_count,commerce_signal,retailer_count,resale_signal,runway_signal,entity_count,composite_score,confidence,status,created_at"
      )
      .in("trend_signal_id", signalIds)
      .gte("metric_date", cutoff.toISOString().slice(0, 10))
      .order("metric_date", { ascending: true });

    if (metricError) {
      throw new Error(metricError.message);
    }

    for (const metric of z.array(trendSignalMetricSchema).parse(metrics ?? [])) {
      const existingMetrics = metricsBySignalId.get(metric.trend_signal_id) ?? [];
      existingMetrics.push(metric);
      metricsBySignalId.set(metric.trend_signal_id, existingMetrics);
    }
  }

  return signals.map((s) => ({
    ...s,
    trend_colour: colourById.get(s.id as string) ?? null,
    entities: (entitiesBySignalId.get(s.id as string) ?? []).slice(0, 4),
    metrics_30d: metricsBySignalId.get(s.id as string) ?? [],
    latest_metric: (() => {
      const metrics = metricsBySignalId.get(s.id as string) ?? [];
      return metrics.at(-1) ?? null;
    })(),
    sources: (sourcesBySignalId.get(s.id as string) ?? [])
      .sort((left, right) => {
        const leftTime = left.publish_date ? new Date(left.publish_date).getTime() : 0;
        const rightTime = right.publish_date ? new Date(right.publish_date).getTime() : 0;
        return rightTime - leftTime;
      })
      .slice(0, 3)
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
  if (garmentTexts.length === 0) return [];
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

export async function getTrendStories(): Promise<TrendStory[]> {
  const supabase = await createClient();
  const { data, error } = await (
    (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          order: (
            col: string,
            opts: { ascending: boolean; nullsFirst: boolean }
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean }
            ) => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
    })
      .from("trend_stories")
      .select(
        "id,headline,framing,momentum_label,dominant_type,attributed_houses,attributed_people,signal_ids,status,confidence_score,created_at,refreshed_at"
      )
      .order("confidence_score", { ascending: false, nullsFirst: false })
      .order("refreshed_at", { ascending: false })
  );

  if (error) throw new Error((error as Error).message ?? String(error));
  return z.array(trendStorySchema).parse(data ?? []);
}

export interface TrendStoryWithMatches {
  story: TrendStory;
  matchingGarmentIds: string[];
  bestMatchType: UserTrendMatch["match_type"] | null;
  bestScore: number;
}

const MATCH_TYPE_RANK: Record<UserTrendMatch["match_type"], number> = {
  exact_match: 3,
  adjacent_match: 2,
  styling_match: 1,
  missing_piece: 0
};

export function assembleStoryMatches(
  stories: TrendStory[],
  matches: UserTrendMatch[]
): TrendStoryWithMatches[] {
  const matchesBySignalId = new Map<string, UserTrendMatch>();
  for (const m of matches) {
    matchesBySignalId.set(m.trend_signal_id, m);
  }

  return stories.map((story) => {
    const storyMatches = (story.signal_ids ?? [])
      .map((sid) => matchesBySignalId.get(sid))
      .filter((m): m is UserTrendMatch => m != null);

    const garmentIds = [
      ...new Set(
        storyMatches.flatMap((m) => {
          const reasoning = m.reasoning_json as {
            matched_garment_ids?: string[];
          };
          return reasoning.matched_garment_ids ?? [];
        })
      )
    ];

    const bestMatch = [...storyMatches].sort(
      (a, b) =>
        MATCH_TYPE_RANK[b.match_type] - MATCH_TYPE_RANK[a.match_type]
    )[0];

    return {
      story,
      matchingGarmentIds: garmentIds,
      bestMatchType: bestMatch?.match_type ?? null,
      bestScore: bestMatch?.score ?? 0
    };
  });
}

export async function getUserTrendStoryMatches(
  userId: string,
  stories: TrendStory[]
): Promise<TrendStoryWithMatches[]> {
  const matches = await getUserTrendMatches(userId);
  return assembleStoryMatches(stories, matches);
}
