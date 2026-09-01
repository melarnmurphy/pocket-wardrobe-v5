import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import { unlockCountForCandidate } from "@/lib/domain/outfits/unlock";
import {
  addWishlistItemSchema,
  wishlistEntrySchema,
  type AddWishlistItemInput,
  type WishlistCard,
  type WishlistEntry
} from "@/lib/domain/wishlist";
import type { TablesInsert } from "@/types/database";

type LookbookEntryInsert = TablesInsert<"lookbook_entries">;

const WISHLIST_SELECT =
  "id,title,image_path,source_url,price_cents,original_price_cents,currency,category,colour_family,size,watch_price,resolved_state,bought_garment_id,created_at";

/**
 * 15a — unlockCount is server-computed with the exact same function the
 * nearby feed's "finishes a look" sort uses (lib/domain/outfits/unlock.ts),
 * per DATA_MODEL.md: "they are the same computation."
 */
export async function listWishlist(): Promise<WishlistCard[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lookbook_entries")
    .select(WISHLIST_SELECT)
    .eq("user_id", user.id)
    .eq("source_type", "wishlist")
    .is("bought_garment_id", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const entries = z.array(wishlistEntrySchema).parse(data ?? []);
  if (!entries.length) return [];

  const [garments, styleRules] = await Promise.all([listWardrobeGarments(), listStyleRules()]);

  return entries.map((entry) => {
    const unlockCount = entry.category
      ? unlockCountForCandidate(garments, styleRules, {
          id: entry.id,
          title: entry.title,
          category: entry.category,
          subcategory: null,
          primary_colour_family: entry.colour_family
        })
      : 0;

    const ownedSimilarCount = entry.category
      ? garments.filter(
          (garment) =>
            garment.category === entry.category &&
            (!entry.colour_family || garment.primary_colour_family === entry.colour_family)
        ).length
      : 0;

    return { ...entry, unlockCount, ownedSimilarCount };
  });
}

export async function addWishlistItem(input: AddWishlistItemInput): Promise<string> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsed = addWishlistItemSchema.parse(input);

  const insert: LookbookEntryInsert = {
    user_id: user.id,
    source_type: "wishlist",
    title: parsed.title,
    image_path: parsed.image_path ?? null,
    source_url: parsed.source_url ?? null,
    price_cents: parsed.price_cents ?? null,
    currency: parsed.currency,
    category: parsed.category ?? null,
    colour_family: parsed.colour_family ?? null,
    size: parsed.size ?? null,
    watch_price: parsed.watch_price,
    resolved_state: "manual"
  };

  const { data, error } = await supabase
    .from("lookbook_entries")
    .insert(insert as never)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to add to the wishlist.");
  }

  return (data as { id: string }).id;
}

export async function setWatchPrice(entryId: string, watch: boolean): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(entryId);

  const { error } = await supabase
    .from("lookbook_entries")
    .update({ watch_price: watch } as never)
    .eq("id", parsedId)
    .eq("user_id", user.id)
    .eq("source_type", "wishlist");

  if (error) {
    throw new Error(error.message);
  }
}

export async function removeWishlistItem(entryId: string): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(entryId);

  const { error } = await supabase
    .from("lookbook_entries")
    .delete()
    .eq("id", parsedId)
    .eq("user_id", user.id)
    .eq("source_type", "wishlist");

  if (error) {
    throw new Error(error.message);
  }
}

/** "the thing is actually bought" — DATA_MODEL.md's convertToGarment. */
export async function markWishlistItemBought(entryId: string, garmentId: string): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedEntryId = z.string().uuid().parse(entryId);
  const parsedGarmentId = z.string().uuid().parse(garmentId);

  const { error } = await supabase
    .from("lookbook_entries")
    .update({ bought_garment_id: parsedGarmentId } as never)
    .eq("id", parsedEntryId)
    .eq("user_id", user.id)
    .eq("source_type", "wishlist");

  if (error) {
    throw new Error(error.message);
  }
}

export type { WishlistEntry };
