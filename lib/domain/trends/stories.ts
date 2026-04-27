import OpenAI from "openai";
import { createServiceClient as createClient } from "@/lib/supabase/service";
import { getServerEnv } from "@/lib/env";
import { STORY_DOMINANT_TYPES, type StoryDominantType, type TrendStory } from "./index";

interface SignalRow {
  id: string;
  label: string;
  canonical_label: string | null;
  trend_type: string;
  family: string | null;
  house_attribution: string[] | null;
  person_attribution: string[] | null;
  confidence_score: number | null;
  score_30d_delta: number | null;
}

export interface StoryCluster {
  signals: SignalRow[];
  groupKey: string;
}

export function clusterSignals(signals: SignalRow[]): StoryCluster[] {
  const groups = new Map<string, SignalRow[]>();
  for (const signal of signals) {
    const key = `${signal.trend_type}::${signal.family ?? signal.canonical_label ?? signal.label}`;
    const group = groups.get(key) ?? [];
    group.push(signal);
    groups.set(key, group);
  }
  return Array.from(groups.entries()).map(([groupKey, sigs]) => ({
    groupKey,
    signals: sigs
  }));
}

export function computeMomentumLabel(signals: SignalRow[]): string | null {
  const deltas = signals
    .map((s) => s.score_30d_delta)
    .filter((d): d is number => d != null);
  if (deltas.length === 0) return null;
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  if (Math.abs(avg) < 0.05) return null;
  const pct = Math.round(avg * 100);
  return pct > 0 ? `+${pct}% search interest` : `${pct}% search interest`;
}

export function buildStoryNamingPrompt(clusters: StoryCluster[]): string {
  const clustersText = clusters
    .map((c, i) => {
      const labels = c.signals
        .map((s) => s.canonical_label || s.label)
        .join(", ");
      const houses = [
        ...new Set(c.signals.flatMap((s) => s.house_attribution ?? []))
      ].join(", ");
      const people = [
        ...new Set(c.signals.flatMap((s) => s.person_attribution ?? []))
      ].join(", ");
      return [
        `Cluster ${i + 1}:`,
        `  Labels: ${labels}`,
        `  Type: ${c.signals[0].trend_type} | Family: ${c.signals[0].family ?? "–"}`,
        houses ? `  Houses: ${houses}` : null,
        people ? `  People: ${people}` : null
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return `You are a fashion editorial director. Give each trend cluster a punchy editorial headline (2-4 words), a one-line framing sentence, and classify its dominant type.

Dominant types: ${STORY_DOMINANT_TYPES.join(", ")}

Clusters:
${clustersText}

Return a JSON array (one object per cluster, in order):
[{
  "cluster_index": 1,
  "headline": "Transparent Denim",
  "framing": "The season's most literal take on exposed dressing.",
  "dominant_type": "garment_moment"
}]

Return only the JSON array. No markdown fences.`;
}

interface NamedCluster {
  cluster_index: number;
  headline: string;
  framing: string;
  dominant_type: StoryDominantType;
}

async function nameClustersBatch(
  clusters: StoryCluster[],
  client: OpenAI
): Promise<NamedCluster[]> {
  if (clusters.length === 0) return [];

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2048,
    messages: [{ role: "user", content: buildStoryNamingPrompt(clusters) }]
  });

  const text = response.choices[0]?.message?.content ?? "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]) as unknown[];
    return parsed.filter(
      (item): item is NamedCluster =>
        typeof item === "object" &&
        item !== null &&
        "cluster_index" in item &&
        "headline" in item &&
        "dominant_type" in item &&
        STORY_DOMINANT_TYPES.includes((item as NamedCluster).dominant_type)
    );
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = { from: (table: string) => any };

async function upsertStory(
  supabase: AnySupabase,
  story: Omit<TrendStory, "id" | "created_at">
): Promise<void> {
  // First try to find existing story by headline (case-insensitive)
  const { data: existing } = await supabase
    .from("trend_stories")
    .select("id, signal_ids")
    .filter("lower(headline)", "eq", story.headline.toLowerCase())
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; signal_ids: string[] };
    const merged = [...new Set([...row.signal_ids, ...(story.signal_ids ?? [])])];
    await supabase
      .from("trend_stories")
      .update({
        signal_ids: merged,
        attributed_houses: story.attributed_houses,
        attributed_people: story.attributed_people,
        momentum_label: story.momentum_label ?? null,
        framing: story.framing ?? null,
        dominant_type: story.dominant_type ?? null,
        confidence_score: story.confidence_score ?? null,
        refreshed_at: new Date().toISOString()
      })
      .eq("id", row.id);
    return;
  }

  // Insert — if concurrent insert wins, skip (the other process got it)
  const { error } = await supabase
    .from("trend_stories")
    .insert({
      headline: story.headline,
      framing: story.framing ?? null,
      momentum_label: story.momentum_label ?? null,
      dominant_type: story.dominant_type ?? null,
      attributed_houses: story.attributed_houses ?? [],
      attributed_people: story.attributed_people ?? [],
      signal_ids: story.signal_ids ?? [],
      status: story.status ?? "candidate",
      confidence_score: story.confidence_score ?? null,
      refreshed_at: new Date().toISOString()
    });

  // Ignore unique constraint violation — a concurrent run inserted it first
  if (error && error.code !== "23505") {
    throw new Error(`Failed to insert trend story: ${error.message}`);
  }
}

export async function generateTrendStories(opts?: {
  lookbackHours?: number;
}): Promise<{ upserted: number; skipped: number }> {
  const supabase = createClient();
  const env = getServerEnv();
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const lookbackHours = opts?.lookbackHours ?? 24;
  const since = new Date();
  since.setUTCHours(since.getUTCHours() - lookbackHours);

  const { data: rawSignals, error } = await (supabase as unknown as AnySupabase)
    .from("trend_signals")
    .select(
      "id,label,canonical_label,trend_type,family,house_attribution,person_attribution,confidence_score,score_30d_delta"
    )
    .gte("last_seen_at", since.toISOString())
    .order("confidence_score", { ascending: false, nullsFirst: false });

  if (error) throw new Error((error as { message: string }).message);

  const signals = (rawSignals ?? []) as SignalRow[];
  if (signals.length === 0) return { upserted: 0, skipped: 0 };

  const clusters = clusterSignals(signals);
  const named = await nameClustersBatch(clusters, client);
  const namedByIndex = new Map(named.map((n) => [n.cluster_index, n]));

  let upserted = 0;
  let fallback = 0;

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const naming = namedByIndex.get(i + 1);
    if (!naming) fallback++;
    const houses = [
      ...new Set(cluster.signals.flatMap((s) => s.house_attribution ?? []))
    ];
    const people = [
      ...new Set(cluster.signals.flatMap((s) => s.person_attribution ?? []))
    ];
    const momentumLabel = computeMomentumLabel(cluster.signals);
    const avgConf =
      cluster.signals.reduce((a, s) => a + (s.confidence_score ?? 0.5), 0) /
      cluster.signals.length;
    const signalIds = cluster.signals.map((s) => s.id);

    await upsertStory(supabase as unknown as AnySupabase, {
      headline:
        naming?.headline ??
        (cluster.signals[0].canonical_label || cluster.signals[0].label),
      framing: naming?.framing ?? null,
      momentum_label: momentumLabel,
      dominant_type: naming?.dominant_type ?? null,
      attributed_houses: houses,
      attributed_people: people,
      signal_ids: signalIds,
      status: "candidate",
      confidence_score: Math.round(avgConf * 100) / 100,
      refreshed_at: new Date().toISOString()
    });

    upserted++;
  }

  return { upserted, skipped: fallback };
}
