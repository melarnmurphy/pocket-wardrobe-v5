/**
 * 8c — trend expiry. Ages trend_signals.trend_status toward 'cooling' then
 * 'flat' as a trend goes quiet, so a stale trend stops reading as current
 * (DATA_MODEL.md's Trend.phase 'fading'/'over' maps onto this repo's
 * existing trend_status vocabulary, added long before this session —
 * reused rather than introducing a parallel field).
 *
 * Auth matches app/api/cron/trend-scanners/route.ts: Vercel cron sends
 * Authorization: Bearer <CRON_SECRET>.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient as createClient } from "@/lib/supabase/service";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const COOLING_AFTER_DAYS = 21;
const FLAT_AFTER_DAYS = 45;

function isAuthorized(request: NextRequest, cronSecret: string | undefined): boolean {
  if (!cronSecret) return false;
  const bearer = request.headers.get("authorization");
  if (bearer && bearer === `Bearer ${cronSecret}`) return true;
  const custom = request.headers.get("x-cron-secret");
  if (custom && custom === cronSecret) return true;
  return false;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const env = getServerEnv();
  if (!isAuthorized(request, env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createClient();
  const now = Date.now();
  const coolingCutoff = new Date(now - COOLING_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const flatCutoff = new Date(now - FLAT_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: toFlat, error: flatError } = await supabase
    .from("trend_signals")
    .update({ trend_status: "flat" } as never)
    .lt("last_seen_at", flatCutoff)
    .not("trend_status", "eq", "flat")
    .select("id");

  if (flatError) {
    return NextResponse.json({ error: flatError.message }, { status: 500 });
  }

  const { data: toCooling, error: coolingError } = await supabase
    .from("trend_signals")
    .update({ trend_status: "cooling" } as never)
    .lt("last_seen_at", coolingCutoff)
    .gte("last_seen_at", flatCutoff)
    .in("trend_status", ["confirmed", "dominant", "emerging"])
    .select("id");

  if (coolingError) {
    return NextResponse.json({ error: coolingError.message }, { status: 500 });
  }

  return NextResponse.json({
    movedToFlat: toFlat?.length ?? 0,
    movedToCooling: toCooling?.length ?? 0
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
