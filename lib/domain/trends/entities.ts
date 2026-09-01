import { canonicalizeLabel } from "./labels";
import type { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type MakerTier = "heritage" | "emerging";

export interface CitedMaker {
  name: string;
  city?: string | null;
  region?: string | null;
  tier?: MakerTier | null;
}

export interface RankedExample {
  label: string;
  tier: MakerTier;
  city: string | null;
  region: string | null;
  local: boolean;
}

const HERITAGE_HOUSES = new Set(
  [
    "adidas",
    "nike",
    "vans",
    "converse",
    "puma",
    "new balance",
    "asics",
    "onitsuka",
    "salomon",
    "prada",
    "miu miu",
    "gucci",
    "celine",
    "dior",
    "chanel",
    "louis vuitton",
    "balenciaga",
    "bottega veneta",
    "saint laurent",
    "ysl",
    "hermes",
    "fendi",
    "versace",
    "acne studios",
    "coperni",
    "dr martens",
    "superga",
    "keds",
    "reebok",
    "hoka"
  ].map((name) => canonicalizeLabel(name))
);

export function classifyMakerTier(name: string, explicit?: string | null): MakerTier {
  if (explicit === "heritage" || explicit === "emerging") return explicit;
  return HERITAGE_HOUSES.has(canonicalizeLabel(name)) ? "heritage" : "emerging";
}

export function parseCitedMakers(attrs: Record<string, unknown>, houses: string[] | undefined): CitedMaker[] {
  const makers: CitedMaker[] = [];
  const seen = new Set<string>();

  const push = (maker: CitedMaker) => {
    const key = canonicalizeLabel(maker.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    makers.push({
      ...maker,
      tier: classifyMakerTier(maker.name, maker.tier)
    });
  };

  const raw = attrs.cited_makers;
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === "string") {
        push({ name: entry });
        continue;
      }
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const name =
          (typeof record.name === "string" && record.name) ||
          (typeof record.label === "string" && record.label) ||
          null;
        if (!name) continue;
        push({
          name,
          city: typeof record.city === "string" ? record.city : null,
          region: typeof record.region === "string" ? record.region : null,
          tier: typeof record.tier === "string" ? (record.tier as MakerTier) : null
        });
      }
    }
  }

  for (const house of houses ?? []) {
    push({ name: house });
  }

  return makers;
}

export function regionOverlapsUser(entityRegion: string | null, entityCity: string | null, userLocation: string | null): boolean {
  if (!userLocation) return false;
  const user = canonicalizeLabel(userLocation);
  const parts = [entityCity, entityRegion].filter(Boolean).map((value) => canonicalizeLabel(value as string));
  return parts.some((part) => part && (user.includes(part) || part.includes(user)));
}

export function rankExamplesForUser(
  examples: RankedExample[],
  userLocation: string | null
): RankedExample | null {
  if (examples.length === 0) return null;
  const scored = examples.map((example) => {
    const local = regionOverlapsUser(example.region, example.city, userLocation);
    let score = example.tier === "emerging" ? 2 : 0;
    if (local) score += 3;
    return { example: { ...example, local }, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.example ?? null;
}

export async function upsertCitedEntities(
  supabase: ServiceClient,
  signalId: string,
  makers: CitedMaker[]
): Promise<void> {
  for (const maker of makers) {
    const normalized = canonicalizeLabel(maker.name);
    const { data: existing } = await supabase
      .from("trend_entities")
      .select("id, source_count, metadata_json")
      .eq("trend_signal_id", signalId)
      .eq("normalized_label", normalized)
      .maybeSingle();

    const now = new Date().toISOString();
    const metadata = {
      tier: maker.tier ?? classifyMakerTier(maker.name),
      city: maker.city ?? null,
      region: maker.region ?? null
    };

    if (existing) {
      const row = existing as { id: string; source_count: number; metadata_json: Record<string, unknown> | null };
      await supabase
        .from("trend_entities")
        .update({
          source_count: row.source_count + 1,
          last_seen_at: now,
          metadata_json: { ...(row.metadata_json ?? {}), ...metadata } as never
        } as never)
        .eq("id", row.id);
      continue;
    }

    await supabase.from("trend_entities").insert({
      trend_signal_id: signalId,
      entity_type: "brand",
      label: maker.name.trim(),
      normalized_label: normalized,
      brand: maker.name.trim(),
      source_count: 1,
      first_seen_at: now,
      last_seen_at: now,
      metadata_json: metadata as never
    } as never);
  }
}
