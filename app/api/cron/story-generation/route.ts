import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { generateTrendStories } from "@/lib/domain/trends/stories";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(
  request: NextRequest,
  cronSecret: string | undefined
): boolean {
  if (!cronSecret) return false;
  const bearer = request.headers.get("authorization");
  if (bearer && bearer === `Bearer ${cronSecret}`) return true;
  const custom = request.headers.get("x-cron-secret");
  if (custom && custom === cronSecret) return true;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const env = getServerEnv();

    if (!isAuthorized(request, env.CRON_SECRET)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const lookbackHours = parseInt(
      url.searchParams.get("lookback_hours") ?? "24",
      10
    );

    const result = await generateTrendStories({ lookbackHours });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/story-generation]", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
