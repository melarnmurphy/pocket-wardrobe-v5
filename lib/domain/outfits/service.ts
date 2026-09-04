import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import { generateOutfit } from "@/lib/domain/outfits/generator";
import { RECENCY_WINDOW_MS } from "@/lib/domain/outfits/ranking";
import type { ServiceContext } from "@/lib/domain/service-context";
import { z } from "zod";
import {
  outfitWithItemsSchema,
  placementInputSchema,
  type GenerateOutfitInput,
  type GeneratedOutfit,
  type OutfitWithItems,
  type PlacementInput,
  type SaveOutfitInput
} from "@/lib/domain/outfits";
import {
  userTrendMatchWithSignalSchema,
  type UserTrendMatchWithSignal
} from "@/lib/domain/trends";
import type { TablesInsert } from "@/types/database";

type OutfitInsert = TablesInsert<"outfits">;
type OutfitItemInsert = TablesInsert<"outfit_items">;

export const listUserTrendMatchesWithSignals = cache(async (ctx?: ServiceContext): Promise<UserTrendMatchWithSignal[]> => {
  const user = ctx ? { id: ctx.userId } : await getRequiredUser();
  const supabase = ctx ? ctx.supabase : await createClient();
  const { data, error } = await supabase
    .from("user_trend_matches")
    .select("*, trend_signal:trend_signals(*)")
    .eq("user_id", user.id)
    .order("score", { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(userTrendMatchWithSignalSchema).parse(data ?? []);
});

export async function generateOutfitForUser(
  input: GenerateOutfitInput,
  isPro: boolean,
  ctx?: ServiceContext,
  // Internal-only: week generation feeds forward garments already used on an
  // earlier day. Not part of the public wire schema (generateOutfitInputSchema)
  // since it's not a per-call user choice, just week-orchestration state.
  excludeGarmentIds?: string[]
): Promise<GeneratedOutfit> {
  const [garments, styleRules] = await Promise.all([
    listWardrobeGarments(ctx),
    listStyleRules(ctx)
  ]);

  let trendSignal: UserTrendMatchWithSignal | null = null;
  if (input.mode === "trend") {
    const matches = await listUserTrendMatchesWithSignals(ctx);
    trendSignal = matches.find(m => m.trend_signal_id === input.trend_signal_id) ?? null;
  }

  const dress_code = input.mode === "plan" ? input.dress_code ?? undefined : undefined;
  const weather    = input.mode === "plan" ? input.weather    ?? undefined : undefined;
  const occasion   = input.mode === "plan" ? input.occasion   ?? undefined : undefined;

  // Free + Pro both run the rules engine.
  // Pro path: TODO — pass top 3 candidates per role to Claude. For now, same as free.
  const result = generateOutfit({
    mode: input.mode,
    garments,
    styleRules,
    trendSignal,
    dress_code,
    weather,
    occasion,
    mustIncludeGarmentIds:
      input.mode === "trend" ? input.must_include_garment_ids : undefined,
    excludeGarmentIds
  });

  // Pro: replace rule tags with Claude prose (stub — not yet wired)
  if (isPro) {
    // Future: call Claude here with top candidates
  }

  return result;
}

export type WeekDayRequest = {
  date: string; // "YYYY-MM-DD"
  occasion?: string | null;
  dress_code?: string | null;
};

export type WeekDayResult = {
  date: string;
  outfit: GeneratedOutfit;
};

/**
 * One outfit per requested day, generated sequentially so each day can
 * exclude the pieces already used earlier in the week (a role whose every
 * candidate is excluded still falls back to reuse — see generator.ts — so a
 * small wardrobe never comes up empty). Also hard-excludes anything worn
 * within RECENCY_WINDOW_MS: the single-outfit generator only soft-penalizes
 * that same window, but a week plan can afford to just avoid it outright.
 * Wear data only becomes real once a garment is logged as worn somewhere
 * (today, that's the web wardrobe closet's "Log Wear" form) — for a garment
 * never logged worn, last_worn_at is null and it's simply never excluded.
 */
export type WeekPlanResult = {
  days: WeekDayResult[];
  // Garments hard-excluded for being recently worn (before any within-week
  // repeats are added) — the Planner's availability card surfaces these by
  // id via GarmentStore, rather than the client re-deriving the recency
  // window itself.
  unavailableGarmentIds: string[];
};

export type WeekPlanOptions = {
  avoidRepeat?: boolean; // default true — feed each day's picks forward as the next day's exclusion
  laundryAware?: boolean; // default true — hard-exclude anything worn within RECENCY_WINDOW_MS
  manualExcludeGarmentIds?: string[]; // always applied regardless of the two flags above
};

export async function generateWeekOfOutfits(
  days: WeekDayRequest[],
  isPro: boolean,
  ctx?: ServiceContext,
  options?: WeekPlanOptions
): Promise<WeekPlanResult> {
  const avoidRepeat = options?.avoidRepeat ?? true;
  const laundryAware = options?.laundryAware ?? true;
  const manualExcludeIds = options?.manualExcludeGarmentIds ?? [];

  const garments = await listWardrobeGarments(ctx);
  const now = Date.now();

  const recentlyWornIds = laundryAware
    ? garments
        .filter((g) => {
          if (!g.last_worn_at) return false;
          const wornAt = Date.parse(g.last_worn_at);
          return !Number.isNaN(wornAt) && now - wornAt < RECENCY_WINDOW_MS;
        })
        .map((g) => g.id as string)
    : [];

  const excludeIds = new Set([...recentlyWornIds, ...manualExcludeIds]);
  const results: WeekDayResult[] = [];
  for (const day of days) {
    const input: GenerateOutfitInput =
      day.occasion || day.dress_code
        ? { mode: "plan", occasion: day.occasion ?? null, dress_code: day.dress_code ?? null, weather: null }
        : { mode: "surprise" };

    const outfit = await generateOutfitForUser(input, isPro, ctx, Array.from(excludeIds));
    if (avoidRepeat) {
      for (const g of outfit.garments) excludeIds.add(g.id);
    }
    results.push({ date: day.date, outfit });
  }

  return { days: results, unavailableGarmentIds: recentlyWornIds };
}

export async function saveOutfit(input: SaveOutfitInput, ctx?: ServiceContext): Promise<string> {
  const user = ctx ? { id: ctx.userId } : await getRequiredUser();
  const supabase = ctx ? ctx.supabase : await createClient();

  const outfitInsert: OutfitInsert = {
    user_id: user.id,
    title: input.title ?? null,
    occasion: input.occasion ?? null,
    dress_code: input.dress_code ?? null,
    planned_for: input.planned_for ?? null,
    weather_context_json: input.weather_context_json as unknown as OutfitInsert["weather_context_json"],
    explanation: input.explanation ?? null,
    explanation_json: input.explanation_json as unknown as OutfitInsert["explanation_json"],
    source_type: "generated"
  };

  const { data: outfit, error: outfitError } = await supabase
    .from("outfits")
    .insert(outfitInsert as never)
    .select("id")
    .single() as unknown as { data: { id: string } | null; error: any };
  if (outfitError) throw new Error(outfitError.message);
  if (!outfit) throw new Error("Outfit insert returned no data.");

  const items: OutfitItemInsert[] = input.garments.map(g => ({
    outfit_id: outfit.id,
    garment_id: g.garment_id,
    role: g.role
  }));

  const { error: itemsError } = await supabase
    .from("outfit_items")
    .insert(items as never);
  if (itemsError) throw new Error(itemsError.message);

  return outfit.id;
}

export const listSavedOutfits = cache(async (ctx?: ServiceContext): Promise<OutfitWithItems[]> => {
  const user = ctx ? { id: ctx.userId } : await getRequiredUser();
  const supabase = ctx ? ctx.supabase : await createClient();

  const { data, error } = await supabase
    .from("outfits")
    .select(`
      id, user_id, title, occasion, dress_code, weather_context_json,
      explanation, explanation_json, source_type, created_at, planned_for,
      items:outfit_items(
        id, outfit_id, garment_id, role, created_at,
        placement_x, placement_y, placement_z, placement_scale, placement_rotation,
        garment:garments(id, title, category)
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return z.array(outfitWithItemsSchema).parse(data ?? []);
});

/** 11b / w3g — a single look, with its wear history and canvas placements. */
export const getOutfitById = cache(async (outfitId: string): Promise<OutfitWithItems | null> => {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(outfitId);

  const { data, error } = await supabase
    .from("outfits")
    .select(`
      id, user_id, title, occasion, dress_code, weather_context_json,
      explanation, explanation_json, source_type, created_at, planned_for,
      items:outfit_items(
        id, outfit_id, garment_id, role, created_at,
        placement_x, placement_y, placement_z, placement_scale, placement_rotation,
        garment:garments(id, title, category)
      )
    `)
    .eq("id", parsedId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return outfitWithItemsSchema.parse(data);
});

/** 6d / w1b — save where each piece was dragged on the look canvas. */
export async function saveOutfitPlacements(params: {
  outfitId: string;
  placements: PlacementInput[];
}): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedOutfitId = z.string().uuid().parse(params.outfitId);
  const parsedPlacements = z.array(placementInputSchema).parse(params.placements);

  const { data: outfit, error: outfitError } = await supabase
    .from("outfits")
    .select("id")
    .eq("id", parsedOutfitId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (outfitError) throw new Error(outfitError.message);
  if (!outfit) throw new Error("Look not found.");

  for (const placement of parsedPlacements) {
    const { error } = await supabase
      .from("outfit_items")
      .update({
        placement_x: placement.x,
        placement_y: placement.y,
        placement_z: placement.z,
        placement_scale: placement.scale,
        placement_rotation: placement.rotation
      } as never)
      .eq("outfit_id", parsedOutfitId)
      .eq("garment_id", placement.garment_id);

    if (error) throw new Error(error.message);
  }
}

export async function deleteOutfit(outfitId: string) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedOutfitId = z.string().uuid().parse(outfitId);

  const { error: itemsError } = await supabase
    .from("outfit_items")
    .delete()
    .eq("outfit_id", parsedOutfitId);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const { error } = await supabase
    .from("outfits")
    .delete()
    .eq("id", parsedOutfitId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function setOutfitPlannedDate(params: {
  outfitId: string;
  date: string | null; // "YYYY-MM-DD" to plan, null to un-plan
}): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  // Enforce one outfit per day: clear any other outfit already on this date.
  if (params.date) {
    const { error: clearError } = await supabase
      .from("outfits")
      .update({ planned_for: null } as never)
      .eq("user_id", user.id)
      .eq("planned_for", params.date)
      .neq("id", params.outfitId);
    if (clearError) throw new Error(clearError.message);
  }

  const { error } = await supabase
    .from("outfits")
    .update({ planned_for: params.date } as never)
    .eq("id", params.outfitId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

// NOTE: Gallery thumbnails (OutfitWithItems.items[].garment.preview_url) will always be null
// in this iteration. The `preview_url` field is computed from the garment_images join + signed
// URLs in listWardrobeGarments — it is not a column on the `garments` table and cannot be
// fetched via a nested Supabase select. The gallery renders empty placeholder slots gracefully.
