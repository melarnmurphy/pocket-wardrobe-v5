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
  const { data, error } = await supabase.rpc("get_sidebar_counts" as never);

  if (error) {
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    wardrobe?: number | string | null;
    looks?: number | string | null;
    wishlist?: number | string | null;
    let_go?: number | string | null;
    handovers?: number | string | null;
  } | null;

  if (!row) return EMPTY_COUNTS;

  const count = (value: number | string | null | undefined) => Number(value ?? 0);

  return {
    wardrobe: count(row.wardrobe),
    looks: count(row.looks),
    wishlist: count(row.wishlist),
    letGo: count(row.let_go),
    nearby: 0,
    handovers: count(row.handovers)
  };
});
