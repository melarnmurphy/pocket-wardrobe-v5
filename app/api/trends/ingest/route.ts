import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { runSourceIngestion } from "@/lib/domain/trends/ingestion";
import { registeredAdapters } from "@/lib/domain/trends/adapters/vogue";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const { CRON_SECRET } = getServerEnv();
  if (!CRON_SECRET) return false;
  const bearer = request.headers.get("authorization");
  if (bearer === `Bearer ${CRON_SECRET}`) return true;
  const custom = request.headers.get("x-cron-secret");
  return custom === CRON_SECRET;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const results = await Promise.all(
      registeredAdapters.map((adapter) => runSourceIngestion(adapter))
    );

    const total = results.reduce(
      (acc, r) => ({
        newSourceCount: acc.newSourceCount + r.newSourceCount,
        queuedJobCount: acc.queuedJobCount + r.queuedJobCount
      }),
      { newSourceCount: 0, queuedJobCount: 0 }
    );

    return NextResponse.json({ ok: true, ...total });
  } catch (err) {
    console.error("[trends/ingest]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
