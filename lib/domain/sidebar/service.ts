import { createClient } from "@/lib/supabase/server";
import { getOptionalUser } from "@/lib/auth";
import { getOrCreateProfile } from "@/lib/domain/profile/service";

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
 * The sidebar renders on every page, so this is count-only queries
 * (head: true — no rows fetched) rather than reusing the full list
 * functions each screen already has, which would be wasteful chrome.
 */
export async function getSidebarCounts(): Promise<SidebarCounts> {
  const user = await getOptionalUser();
  if (!user) return EMPTY_COUNTS;

  const supabase = await createClient();

  const [wardrobe, looks, wishlist, letGo, threads, profile] = await Promise.all([
    supabase
      .from("garments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("archived_at", null),
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
      .not("let_go_reason", "is", null),
    supabase
      .from("threads")
      .select("id", { count: "exact", head: true })
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
    getOrCreateProfile().catch(() => null)
  ]);

  let nearbyCount = 0;
  if (profile?.suburb_lat !== null && profile?.suburb_lat !== undefined) {
    const { count } = await supabase.rpc(
      "nearby_listings" as never,
      {
        viewer_lat: profile.suburb_lat,
        viewer_lng: profile.suburb_lng,
        radius_km: profile.radius_km,
        max_price_cents: null,
        sort_key: "closest"
      } as never,
      { count: "exact", head: true } as never
    );
    nearbyCount = count ?? 0;
  }

  return {
    wardrobe: wardrobe.count ?? 0,
    looks: looks.count ?? 0,
    wishlist: wishlist.count ?? 0,
    letGo: letGo.count ?? 0,
    nearby: nearbyCount,
    handovers: threads.count ?? 0
  };
}
