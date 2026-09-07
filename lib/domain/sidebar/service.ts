import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getOptionalUser } from "@/lib/auth";

export type SidebarCounts = {
  wardrobe: number;
  looks: number;
  wishlist: number;
  letGo: number;
  nearby: number;
  handovers: number;
};

const EMPTY_COUNTS: SidebarCounts = {
  wardrobe: 0,
  looks: 0,
  wishlist: 0,
  letGo: 0,
  nearby: 0,
  handovers: 0
};

/**
 * Count-only queries for app chrome. Nearby radius matching is a haversine
 * scan (`nearby_listings`) and must not run on every page — it blocked reloads
 * of wardrobe/today/etc. The nearby screen still uses the RPC itself.
 */
export const getSidebarCounts = cache(async (): Promise<SidebarCounts> => {
  const user = await getOptionalUser();
  if (!user) return EMPTY_COUNTS;

  const supabase = await createClient();

  const [wardrobe, looks, wishlist, letGo, threads] = await Promise.all([
    supabase
      .from("garments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("archived_at", null)
      .is("deleted_at", null),
    supabase.from("outfits").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("lookbook_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("source_type", "wishlist")
      .is("bought_garment_id", null),
    supabase
      .from("garments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("archived_at", null)
      .is("deleted_at", null)
      .not("let_go_reason", "is", null),
    supabase
      .from("threads")
      .select("id", { count: "exact", head: true })
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
  ]);

  return {
    wardrobe: wardrobe.count ?? 0,
    looks: looks.count ?? 0,
    wishlist: wishlist.count ?? 0,
    letGo: letGo.count ?? 0,
    nearby: 0,
    handovers: threads.count ?? 0
  };
});
