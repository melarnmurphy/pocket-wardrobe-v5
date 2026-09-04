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
import { createNotification } from "@/lib/domain/notifications/service";

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

  const expiredIds = [...(toFlat ?? []), ...(toCooling ?? [])].map((row) => (row as { id: string }).id);
  let notified = 0;

  if (expiredIds.length > 0) {
    const { data: follows } = await supabase
      .from("trend_follows")
      .select("user_id,trend_signal_id")
      .in("trend_signal_id", expiredIds);

    if (follows && follows.length > 0) {
      const { data: signals } = await supabase
        .from("trend_signals")
        .select("id,canonical_label,label")
        .in("id", expiredIds);

      const labelById = new Map(
        (signals ?? []).map((s) => {
          const signal = s as { id: string; canonical_label: string | null; label: string };
          return [signal.id, signal.canonical_label || signal.label];
        })
      );

      for (const follow of follows as Array<{ user_id: string; trend_signal_id: string }>) {
        await createNotification({
          userId: follow.user_id,
          kind: "trend expiry",
          title: "A trend you followed is fading",
          body: `${labelById.get(follow.trend_signal_id) ?? "A trend"} is winding down.`,
          subjectKind: "trend",
          subjectId: follow.trend_signal_id
        });
        notified += 1;
      }
    }
  }

  return NextResponse.json({
    movedToFlat: toFlat?.length ?? 0,
    movedToCooling: toCooling?.length ?? 0,
    notified
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
