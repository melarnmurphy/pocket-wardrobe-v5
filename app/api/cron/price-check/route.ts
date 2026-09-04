/**
 * Price drop — re-checks watch_price wishlist entries' source_url against
 * the stored price_cents, notifying the owner when it's dropped. Best
 * effort: fetchPriceFromUrl (lib/domain/wishlist/price-check.ts) only reads
 * JSON-LD or Open Graph product-price markup — a retailer page with neither
 * is silently skipped, not treated as an error.
 *
 * Runs entries in small concurrent batches rather than one at a time: this
 * project's crons cap at maxDuration = 60s (see trend-scanners,
 * story-generation), and each fetch can take up to FETCH_CONCURRENCY *
 * fetchPriceFromUrl's own per-request timeout to time out — sequential
 * would blow the budget past a small handful of entries. MAX_ENTRIES_PER_RUN
 * bounds worst case at ceil(80/8) batches * 6s ≈ 60s.
 *
 * Auth matches app/api/cron/trend-expiry/route.ts: Vercel cron sends
 * Authorization: Bearer <CRON_SECRET>.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient as createClient } from "@/lib/supabase/service";
import { getServerEnv } from "@/lib/env";
import { createNotification } from "@/lib/domain/notifications/service";
import { fetchPriceFromUrl } from "@/lib/domain/wishlist/price-check";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FETCH_CONCURRENCY = 8;
const MAX_ENTRIES_PER_RUN = 80;

function isAuthorized(request: NextRequest, cronSecret: string | undefined): boolean {
  if (!cronSecret) return false;
  const bearer = request.headers.get("authorization");
  if (bearer && bearer === `Bearer ${cronSecret}`) return true;
  const custom = request.headers.get("x-cron-secret");
  if (custom && custom === cronSecret) return true;
  return false;
}

type WishlistPriceEntry = {
  id: string;
  user_id: string;
  title: string | null;
  source_url: string | null;
  price_cents: number | null;
  original_price_cents: number | null;
};

async function checkOneEntry(
  supabase: ReturnType<typeof createClient>,
  entry: WishlistPriceEntry
): Promise<"checked" | "dropped" | "skipped"> {
  if (!entry.source_url) return "skipped";

  const fetched = await fetchPriceFromUrl(entry.source_url);
  if (!fetched) return "checked";

  if (entry.price_cents === null) {
    // First price ever recorded for this entry — nothing to compare
    // against yet, so just store it rather than call it a "drop".
    await supabase
      .from("lookbook_entries")
      .update({ price_cents: fetched.priceCents } as never)
      .eq("id", entry.id);
    return "checked";
  }

  if (fetched.priceCents >= entry.price_cents) {
    return "checked";
  }

  await supabase
    .from("lookbook_entries")
    .update({
      price_cents: fetched.priceCents,
      original_price_cents: entry.original_price_cents ?? entry.price_cents
    } as never)
    .eq("id", entry.id);

  await createNotification({
    userId: entry.user_id,
    kind: "price drop",
    title: "Price drop",
    body: `${entry.title ?? "An item on your wishlist"} dropped to $${(fetched.priceCents / 100).toFixed(2)}.`,
    subjectKind: "wishlist",
    subjectId: entry.id
  });
  return "dropped";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const env = getServerEnv();
  if (!isAuthorized(request, env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createClient();

  const { data: entries, error } = await supabase
    .from("lookbook_entries")
    .select("id,user_id,title,source_url,price_cents,original_price_cents")
    .eq("source_type", "wishlist")
    .eq("watch_price", true)
    .is("bought_garment_id", null)
    .not("source_url", "is", null)
    // Oldest-first, not "least recently checked" — there's no per-entry
    // last-checked column. Fine below MAX_ENTRIES_PER_RUN total watched
    // items; beyond that the newest entries would starve, which isn't worth
    // a schema change for at current scale.
    .order("created_at", { ascending: true })
    .limit(MAX_ENTRIES_PER_RUN);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const queue = (entries ?? []) as WishlistPriceEntry[];
  let checked = 0;
  let dropped = 0;

  for (let i = 0; i < queue.length; i += FETCH_CONCURRENCY) {
    const batch = queue.slice(i, i + FETCH_CONCURRENCY);
    const results = await Promise.all(batch.map((entry) => checkOneEntry(supabase, entry)));
    for (const result of results) {
      if (result === "checked") checked += 1;
      if (result === "dropped") {
        checked += 1;
        dropped += 1;
      }
    }
  }

  return NextResponse.json({ checked, dropped, queued: queue.length });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
