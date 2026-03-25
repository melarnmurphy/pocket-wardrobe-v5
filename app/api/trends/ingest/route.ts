import { NextResponse } from "next/server";
import { runSourceIngestion } from "@/lib/domain/trends/ingestion";
import { registeredAdapters } from "@/lib/domain/trends/adapters/vogue";

export const dynamic = "force-dynamic";

export async function POST() {
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
