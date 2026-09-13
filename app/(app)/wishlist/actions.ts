"use server";

import { revalidatePath } from "next/cache";
import {
  addWishlistItem,
  removeWishlistItem,
  setWatchPrice
} from "@/lib/domain/wishlist/service";
import type { AddWishlistItemInput } from "@/lib/domain/wishlist";
import { extractProductMetadataFromUrl } from "@/lib/domain/ingestion/extractors";
import { userFacingError } from "@/lib/ui/user-facing-error";

type ActionResult = { status: "success" } | { status: "error"; message: string };

/** Shared with the wardrobe's product-link ingestion (API_CONTRACT.md's resolveProductUrl). */
export async function resolveWishlistUrlAction(
  url: string
): Promise<
  | { status: "success"; title: string | null; priceCents: number | null; category: string | null; colour: string | null }
  | { status: "error"; message: string }
> {
  try {
    const metadata = await extractProductMetadataFromUrl(url);
    const priceCents = metadata.price ? Math.round(Number.parseFloat(metadata.price) * 100) : null;
    return {
      status: "success",
      title: metadata.title,
      priceCents: Number.isFinite(priceCents) ? priceCents : null,
      category: metadata.category,
      colour: metadata.colour
    };
  } catch (error) {
    return {
      status: "error",
      message: userFacingError(error, "we couldn't read that link. check it and try again.")
    };
  }
}

export async function addWishlistItemAction(input: AddWishlistItemInput): Promise<ActionResult> {
  try {
    await addWishlistItem(input);
    revalidatePath("/wishlist");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: userFacingError(error, "we couldn't add that to your wishlist. try again.")
    };
  }
}

export async function removeWishlistItemAction(entryId: string): Promise<ActionResult> {
  try {
    await removeWishlistItem(entryId);
    revalidatePath("/wishlist");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: userFacingError(error, "we couldn't remove that from your wishlist. try again.")
    };
  }
}

export async function setWatchPriceAction(entryId: string, watch: boolean): Promise<ActionResult> {
  try {
    await setWatchPrice(entryId, watch);
    revalidatePath("/wishlist");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: userFacingError(error, "we couldn't update that wishlist item. try again.")
    };
  }
}
