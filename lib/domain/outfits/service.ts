import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import { generateOutfit } from "@/lib/domain/outfits/generator";
import {
  outfitWithItemsSchema,
  type GenerateOutfitInput,
  type GeneratedOutfit,
  type OutfitWithItems,
  type SaveOutfitInput
} from "@/lib/domain/outfits";
import {
  userTrendMatchWithSignalSchema,
  type UserTrendMatchWithSignal
} from "@/lib/domain/trends";
import type { TablesInsert } from "@/types/database";
import { z } from "zod";

type OutfitInsert = TablesInsert<"outfits">;
type OutfitItemInsert = TablesInsert<"outfit_items">;

export async function listUserTrendMatchesWithSignals(): Promise<UserTrendMatchWithSignal[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_trend_matches")
    .select("*, trend_signal:trend_signals(*)")
    .eq("user_id", user.id)
    .order("score", { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(userTrendMatchWithSignalSchema).parse(data ?? []);
}

export async function generateOutfitForUser(
  input: GenerateOutfitInput,
  isPro: boolean
): Promise<GeneratedOutfit> {
  const [garments, styleRules] = await Promise.all([
    listWardrobeGarments(),
    listStyleRules()
  ]);

  let trendSignal: UserTrendMatchWithSignal | null = null;
  if (input.mode === "trend") {
    const matches = await listUserTrendMatchesWithSignals();
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
    occasion
  });

  // Pro: replace rule tags with Claude prose (stub — not yet wired)
  if (isPro) {
    // Future: call Claude here with top candidates
  }

  return result;
}

export async function saveOutfit(input: SaveOutfitInput): Promise<string> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const outfitInsert: OutfitInsert = {
    user_id: user.id,
    title: input.title ?? null,
    occasion: input.occasion ?? null,
    dress_code: input.dress_code ?? null,
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

export async function listSavedOutfits(): Promise<OutfitWithItems[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outfits")
    .select(`
      id, user_id, title, occasion, dress_code, weather_context_json,
      explanation, explanation_json, source_type, created_at,
      items:outfit_items(
        id, outfit_id, garment_id, role, created_at,
        garment:garments(id, title, category)
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return z.array(outfitWithItemsSchema).parse(data ?? []);
}

// NOTE: Gallery thumbnails (OutfitWithItems.items[].garment.preview_url) will always be null
// in this iteration. The `preview_url` field is computed from the garment_images join + signed
// URLs in listWardrobeGarments — it is not a column on the `garments` table and cannot be
// fetched via a nested Supabase select. The gallery renders empty placeholder slots gracefully.
