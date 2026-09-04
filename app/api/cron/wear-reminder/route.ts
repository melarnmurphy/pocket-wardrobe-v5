/**
 * Wear reminder — notifies an owner when a wearable, non-archived,
 * non-let-go piece hasn't been worn (or has never been worn) in
 * REMINDER_AFTER_DAYS. Re-run daily, but only notifies once per period per
 * garment, by checking for an existing "wear reminder" notification on that
 * subject within the window before sending another.
 *
 * Auth matches app/api/cron/trend-expiry/route.ts: Vercel cron sends
 * Authorization: Bearer <CRON_SECRET>.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient as createClient } from "@/lib/supabase/service";
import { getServerEnv } from "@/lib/env";
import { createNotification } from "@/lib/domain/notifications/service";

export const dynamic = "force-dynamic";

const REMINDER_AFTER_DAYS = 60;

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
  const cutoff = new Date(Date.now() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error } = await supabase
    .from("garments")
    .select("id,user_id,title,last_worn_at")
    .eq("availability", "wearable")
    .is("archived_at", null)
    .is("let_go_reason", null)
    .or(`last_worn_at.is.null,last_worn_at.lt.${cutoff}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let notified = 0;

  for (const garment of (candidates ?? []) as Array<{
    id: string;
    user_id: string;
    title: string | null;
    last_worn_at: string | null;
  }>) {
    const { data: recentReminder } = await supabase
      .from("app_notifications")
      .select("id")
      .eq("kind", "wear reminder")
      .eq("subject_kind", "piece")
      .eq("subject_id", garment.id)
      .gte("created_at", cutoff)
      .limit(1);

    if (recentReminder && recentReminder.length > 0) {
      continue;
    }

    await createNotification({
      userId: garment.user_id,
      kind: "wear reminder",
      title: "Hasn't been worn in a while",
      body: garment.last_worn_at
        ? `${garment.title ?? "A piece"} hasn't been worn in ${REMINDER_AFTER_DAYS}+ days.`
        : `${garment.title ?? "A piece"} has never been worn.`,
      subjectKind: "piece",
      subjectId: garment.id
    });
    notified += 1;
  }

  return NextResponse.json({ candidates: candidates?.length ?? 0, notified });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
