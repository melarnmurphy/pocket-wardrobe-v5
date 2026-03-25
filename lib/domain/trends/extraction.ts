import OpenAI from "openai";
import { createServiceClient as createClient } from "@/lib/supabase/service";
import { getServerEnv } from "@/lib/env";
import { canonicalizeLabel } from "./matching";
import { getCanonicalWardrobeColour, canonicalWardrobeColours } from "@/lib/domain/wardrobe/colours";
import { TREND_TYPES, type TrendType } from "./index";
import type { TablesInsert } from "@/types/database";
import { chunkText, scoreChunkRelevance, extractColoursFromText } from "./content";
import { resolveSeasonYear } from "./seasons";

type TrendSignalInsert = TablesInsert<"trend_signals">;
type TrendColourInsert = TablesInsert<"trend_colours">;
type TrendSignalSourceInsert = TablesInsert<"trend_signal_sources">;

const COLOUR_FAMILIES = canonicalWardrobeColours.map((c) => c.family);

interface SourceContext {
  title: string;
  excerpt: string | null;
  author: string | null;
  publishDate: string | null;
  sourceName: string;
}

interface ExtractedSignal {
  trend_type: TrendType;
  label: string;
  normalized_attributes: Record<string, unknown>;
  season: string | null;
  region: string | null;
  confidence: number;
}

export function buildExtractionPrompt(source: SourceContext): string {
  const colourList = COLOUR_FAMILIES.join(", ");
  const trendTypeList = TREND_TYPES.join(", ");
  return `You are a fashion trend analyst. Extract concrete trend signals from the following article excerpt.

Source: ${source.sourceName}
Title: ${source.title}
${source.author ? `Author: ${source.author}` : ""}
${source.publishDate ? `Published: ${source.publishDate}` : ""}

Excerpt:
${source.excerpt ?? source.title}

Rules:
- Extract ONLY concrete, specific trend claims. Skip vague statements like "it was a great season".
- For trend_type "colour", family MUST be one of: ${colourList}
- Keep labels concise (max 8 words). Examples: "wide-leg trousers", "butter yellow", "quiet luxury aesthetic"
- Set confidence between 0.5 (mentioned once, implicitly) and 1.0 (headline trend, explicitly stated)
- Return an empty array if no concrete trend signals are present

Return a JSON array. Each signal:
{
  "trend_type": one of: ${trendTypeList},
  "label": string,
  "normalized_attributes": object,
  "season": string or null,
  "region": string or null,
  "confidence": number 0-1
}`;
}

async function parseClaudeResponse(content: string): Promise<ExtractedSignal[]> {
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as unknown[];
    return parsed.filter(
      (s): s is ExtractedSignal =>
        typeof s === "object" &&
        s !== null &&
        "trend_type" in s &&
        "label" in s &&
        TREND_TYPES.includes((s as ExtractedSignal).trend_type)
    );
  } catch {
    return [];
  }
}

async function upsertTrendSignal(
  supabase: ReturnType<typeof createClient>,
  signal: ExtractedSignal,
  authorityScore: number
): Promise<string> {
  const canonical = canonicalizeLabel(signal.label);

  const { data: existing } = await supabase
    .from("trend_signals")
    .select("id, source_count, authority_score, season, year")
    .eq("trend_type", signal.trend_type)
    .ilike("label", canonical)
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; source_count: number; authority_score: number | null; season: string | null; year: number | null };
    const newCount = row.source_count + 1;
    const newAuthority = row.authority_score
      ? (row.authority_score * row.source_count + authorityScore) / newCount
      : authorityScore;

    await supabase
      .from("trend_signals")
      .update(({
        source_count: newCount,
        authority_score: Math.round(newAuthority * 100) / 100,
        last_seen_at: new Date().toISOString(),
        ...(signal.season && !row.season ? { season: signal.season } : {}),
        ...(signal.season && !row.year ? { year: new Date().getFullYear() } : {})
      } as never))
      .eq("id", row.id);

    return row.id;
  }

  const insert: TrendSignalInsert = {
    trend_type: signal.trend_type,
    label: signal.label,
    normalized_attributes_json: signal.normalized_attributes as never,
    season: signal.season ?? null,
    year: new Date().getFullYear(),
    region: signal.region ?? null,
    source_count: 1,
    authority_score: authorityScore,
    confidence_score: signal.confidence,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("trend_signals")
    .insert(insert as never)
    .select("id")
    .single();

  if (error) throw new Error(`Failed to insert trend signal: ${error.message}`);
  return (data as { id: string }).id;
}

async function upsertTrendColour(
  supabase: ReturnType<typeof createClient>,
  signalId: string,
  signal: ExtractedSignal,
  source: { source_name: string; source_url: string; authority_score: number }
): Promise<void> {
  const attrs = signal.normalized_attributes as { family?: string; undertone?: string; lightness_band?: string };
  const canonical = getCanonicalWardrobeColour(attrs.family ?? null);
  if (!canonical) return;

  const rgb = { r: canonical.rgb_r, g: canonical.rgb_g, b: canonical.rgb_b };

  const insert: TrendColourInsert = {
    trend_signal_id: signalId,
    source_name: source.source_name,
    source_url: source.source_url,
    source_label: signal.label,
    canonical_hex: canonical.hex,
    canonical_rgb: rgb as never,
    family: canonical.family,
    undertone: (attrs.undertone as TrendColourInsert["undertone"]) ?? canonical.undertone ?? null,
    saturation_band: (canonical.saturation_band as TrendColourInsert["saturation_band"]) ?? null,
    lightness_band: (attrs.lightness_band as TrendColourInsert["lightness_band"]) ?? canonical.lightness_band ?? null,
    importance_score: signal.confidence * source.authority_score,
    observed_at: new Date().toISOString()
  };

  const { error } = await supabase.from("trend_colours").insert(insert as never);
  if (error && error.code !== "23505") {
    console.warn("[extraction] Failed to insert trend_colour:", error.message);
  }
}

function buildSignalEmbeddingText(label: string, trendType: string, attrs: Record<string, unknown>): string {
  return `${label} | ${trendType} | ${JSON.stringify(attrs)}`;
}

async function batchGenerateEmbeddings(client: OpenAI, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texts
  });
  return response.data.map((d) => d.embedding);
}

async function storeEmbeddingsForSignals(
  supabase: ReturnType<typeof createClient>,
  signals: Array<{ id: string; label: string; trend_type: string; attrs: Record<string, unknown> }>,
  client: OpenAI
): Promise<void> {
  // Only embed signals that don't already have embeddings
  const { data: existing } = await supabase
    .from("trend_signals")
    .select("id")
    .in("id", signals.map((s) => s.id))
    .not("embedding", "is", null);

  const existingIds = new Set((existing ?? []).map((r: { id: string }) => r.id));
  const toEmbed = signals.filter((s) => !existingIds.has(s.id));
  if (toEmbed.length === 0) return;

  const texts = toEmbed.map((s) => buildSignalEmbeddingText(s.label, s.trend_type, s.attrs));
  const embeddings = await batchGenerateEmbeddings(client, texts);

  for (let i = 0; i < toEmbed.length; i++) {
    const embedding = embeddings[i];
    if (!embedding) continue;
    await supabase
      .from("trend_signals")
      .update(({ embedding } as never))
      .eq("id", toEmbed[i].id);
  }
}

export async function processExtractionJob(jobId: string): Promise<void> {
  const supabase = createClient();
  const env = getServerEnv();

  const { data: job, error: jobError } = await supabase
    .from("trend_ingestion_jobs")
    .select("id, metadata_json, status")
    .eq("id", jobId)
    .single();

  if (jobError || !job) throw new Error("Job not found");

  const meta = (job as { metadata_json: Record<string, unknown> }).metadata_json;
  const sourceId = meta.source_id as string;
  const authorityScore = (meta.authority_score as number) ?? 0.7;

  await supabase
    .from("trend_ingestion_jobs")
    .update(({ status: "running" } as never))
    .eq("id", jobId);

  try {
    const { data: source, error: sourceError } = await supabase
      .from("trend_sources")
      .select("id, title, raw_text_excerpt, author, publish_date, source_name, source_url")
      .eq("id", sourceId)
      .single();

    if (sourceError || !source) throw new Error("Source not found");

    const sourceRow = source as {
      id: string; title: string; raw_text_excerpt: string | null;
      author: string | null; publish_date: string | null;
      source_name: string; source_url: string;
    };

    const fullText = sourceRow.raw_text_excerpt ?? sourceRow.title;

    // Resolve season/year once per job (explicit text beats date inference)
    const resolvedSeason = resolveSeasonYear(fullText, sourceRow.publish_date);

    // ─── Local colour extraction (zero LLM cost) ───────────────────────────
    const localColours = extractColoursFromText(fullText);

    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    // ─── Chunk + filter for LLM extraction ───────────────────────────────
    const chunks = chunkText(fullText, 800, 150);
    const relevantChunks = chunks.filter((c) => scoreChunkRelevance(c) > 0.15);
    // Fallback: if no chunks pass the filter, use the full text as-is
    const chunksToProcess = relevantChunks.length > 0 ? relevantChunks : [fullText];

    // ─── Collect all signals across chunks, dedup by canonical label ──────
    const seenLabels = new Set<string>();
    const allSignals: ExtractedSignal[] = [];

    for (const chunk of chunksToProcess) {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        messages: [{ role: "user", content: buildExtractionPrompt({
          title: sourceRow.title,
          excerpt: chunk,
          author: sourceRow.author,
          publishDate: sourceRow.publish_date,
          sourceName: sourceRow.source_name
        }) }]
      });

      const text = response.choices[0]?.message?.content ?? "";
      const signals = await parseClaudeResponse(text);

      for (const signal of signals) {
        const canonical = canonicalizeLabel(signal.label);
        if (!seenLabels.has(canonical)) {
          seenLabels.add(canonical);
          // Apply resolved season/year if the signal has none
          if (!signal.season && resolvedSeason) {
            signal.season = resolvedSeason.season;
          }
          allSignals.push(signal);
        }
      }
    }

    // ─── Upsert locally-extracted colour signals ──────────────────────────
    for (const colour of localColours) {
      const colourSignal: ExtractedSignal = {
        trend_type: "colour",
        label: colour.term,
        normalized_attributes: { family: colour.family },
        season: resolvedSeason?.season ?? null,
        region: null,
        confidence: Math.min(0.5 + colour.count * 0.1, 1.0)
      };
      const canonical = canonicalizeLabel(colourSignal.label);
      if (!seenLabels.has(canonical)) {
        seenLabels.add(canonical);
        allSignals.push(colourSignal);
      }
    }

    // ─── Upsert all signals ───────────────────────────────────────────────
    const upsertedSignals: Array<{ id: string; label: string; trend_type: string; attrs: Record<string, unknown> }> = [];

    for (const signal of allSignals) {
      const signalId = await upsertTrendSignal(supabase, signal, authorityScore);

      if (signal.trend_type === "colour") {
        await upsertTrendColour(supabase, signalId, signal, {
          source_name: sourceRow.source_name,
          source_url: sourceRow.source_url,
          authority_score: authorityScore
        });
      }

      const sourceLink: TrendSignalSourceInsert = {
        trend_signal_id: signalId,
        trend_source_id: sourceRow.id,
        evidence_json: { excerpt: fullText.slice(0, 200) } as never
      };

      const { error: linkError } = await supabase.from("trend_signal_sources").insert(sourceLink as never);
      if (linkError && linkError.code !== "23505") {
        console.warn("[extraction] Failed to link signal to source:", linkError.message);
      }

      upsertedSignals.push({
        id: signalId,
        label: signal.label,
        trend_type: signal.trend_type,
        attrs: signal.normalized_attributes
      });
    }

    // ─── Batch embed all new signals ──────────────────────────────────────
    await storeEmbeddingsForSignals(supabase, upsertedSignals, client);

    await supabase
      .from("trend_ingestion_jobs")
      .update(({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        metadata_json: { ...meta, signals_extracted: allSignals.length }
      } as never))
      .eq("id", jobId);
  } catch (err) {
    await supabase
      .from("trend_ingestion_jobs")
      .update(({
        status: "failed",
        completed_at: new Date().toISOString(),
        metadata_json: { ...meta, error: String(err) }
      } as never))
      .eq("id", jobId);
    throw err;
  }
}
