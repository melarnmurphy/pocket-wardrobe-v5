/**
 * Cron entry point for the Gemini-grounded trend scanners.
 *
 * Mirrors maci's /api/cron/watch-signals route (`app/api/cron/watch-signals/
 * route.ts:7-49` in the maci repo). A single endpoint, invoked on multiple
 * Vercel-cron schedules from `vercel.json`, each passing `?archetype=<name>`
 * to target one scanner at the right cadence.
 *
 * Auth: Vercel cron sends `Authorization: Bearer <CRON_SECRET>`. Manual
 * curls may use the same header or `x-cron-secret`.
 *
 * Query params:
 *   archetype (optional): one of "editorial" | "runway" | "street_social" |
 *                         "colour_authority". If omitted, all scanners run,
 *                         each gated by its defaultCadenceDays.
 *   force (optional): if "true", bypass the cadence gate (useful for
 *                     manual re-runs).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient as createClient } from "@/lib/supabase/service";
import { getServerEnv } from "@/lib/env";
import {
  SCANNERS,
  SCANNER_BY_ARCHETYPE,
  type GroundingScanner,
  type ScannerArchetype,
  type ScannerRunInput
} from "@/lib/domain/trends/prompts/grounding-prompts";
import { runGroundingScan } from "@/lib/domain/trends/adapters/tavily-search";

export const dynamic = "force-dynamic";
// Grounding calls + extraction queue writes can exceed the default 10s.
export const maxDuration = 60;

function isAuthorized(request: NextRequest, cronSecret: string | undefined): boolean {
  if (!cronSecret) return false;
  const bearer = request.headers.get("authorization");
  if (bearer && bearer === `Bearer ${cronSecret}`) return true;
  const custom = request.headers.get("x-cron-secret");
  if (custom && custom === cronSecret) return true;
  return false;
}

/**
 * Returns the completed_at of the most recent successful scan for a scanner,
 * or null if none on record.
 */
async function lastSuccessfulRun(
  supabase: ReturnType<typeof createClient>,
  archetype: ScannerArchetype
): Promise<string | null> {
  const { data } = await supabase
    .from("trend_ingestion_jobs")
    .select("completed_at, metadata_json")
    .eq("job_type", "source_ingestion")
    .eq("status", "succeeded")
    .order("completed_at", { ascending: false })
    .limit(25);

  const rows = (data ?? []) as Array<{
    completed_at: string | null;
    metadata_json: { adapter?: string; scanner_archetype?: string } | null;
  }>;

  for (const row of rows) {
    if (
      row.metadata_json?.adapter === "tavily_search" &&
      row.metadata_json.scanner_archetype === archetype
    ) {
      return row.completed_at;
    }
  }
  return null;
}

function cadenceElapsed(
  lastRunIso: string | null,
  cadenceDays: number
): boolean {
  if (!lastRunIso) return true;
  const last = new Date(lastRunIso).getTime();
  const now = Date.now();
  const elapsedDays = (now - last) / (1000 * 60 * 60 * 24);
  return elapsedDays >= cadenceDays;
}

/**
 * Load recent trend_signals labels scoped to the scanner's target trend
 * types, for the last N days. Passed into the scanner as `previousLabels`
 * so the grounding prompt can flag new-vs-intensifying-vs-fading.
 */
async function loadPreviousLabels(
  supabase: ReturnType<typeof createClient>,
  scanner: GroundingScanner,
  lookbackDays: number
): Promise<string[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - lookbackDays);

  const { data } = await supabase
    .from("trend_signals")
    .select("label, trend_type, last_seen_at")
    .in("trend_type", [...scanner.targetTrendTypes])
    .gte("last_seen_at", since.toISOString())
    .order("last_seen_at", { ascending: false })
    .limit(100);

  return ((data ?? []) as Array<{ label: string }>).map((r) => r.label);
}

async function runOneScanner(
  scanner: GroundingScanner,
  opts: { force: boolean; now: string }
): Promise<{
  archetype: ScannerArchetype;
  skipped: boolean;
  reason?: string;
  citationCount?: number;
  newSourceCount?: number;
  queuedJobCount?: number;
  error?: string;
}> {
  const supabase = createClient();

  if (!opts.force) {
    const lastRun = await lastSuccessfulRun(supabase, scanner.archetype);
    if (!cadenceElapsed(lastRun, scanner.defaultCadenceDays)) {
      return {
        archetype: scanner.archetype,
        skipped: true,
        reason: `cadence (${scanner.defaultCadenceDays}d) has not elapsed since ${lastRun}`
      };
    }
  }

  const previousLabels = await loadPreviousLabels(
    supabase,
    scanner,
    // Window of "recently seen" — roughly 2× cadence so we don't miss a run.
    Math.max(scanner.defaultCadenceDays * 2, 14)
  );

  const input: ScannerRunInput = {
    now: opts.now,
    previousLabels
  };

  try {
    const result = await runGroundingScan(scanner, input);
    return {
      archetype: scanner.archetype,
      skipped: false,
      citationCount: result.citationCount,
      newSourceCount: result.newSourceCount,
      queuedJobCount: result.queuedJobCount
    };
  } catch (err) {
    return {
      archetype: scanner.archetype,
      skipped: false,
      error: String(err)
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const env = getServerEnv();

    if (!isAuthorized(request, env.CRON_SECRET)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const archetypeParam = url.searchParams.get("archetype") as
      | ScannerArchetype
      | null;
    const force = url.searchParams.get("force") === "true";

    const scannersToRun: GroundingScanner[] = archetypeParam
      ? SCANNER_BY_ARCHETYPE[archetypeParam]
        ? [SCANNER_BY_ARCHETYPE[archetypeParam]]
        : []
      : [...SCANNERS];

    if (archetypeParam && scannersToRun.length === 0) {
      return NextResponse.json(
        { error: `Unknown archetype: ${archetypeParam}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const results = [];
    for (const scanner of scannersToRun) {
      // Sequential, not parallel — Gemini grounding + supabase writes are
      // cheap per-call but a single cron invocation only has ~60s.
      results.push(await runOneScanner(scanner, { force, now }));
    }

    const processed = results.filter((r) => !r.skipped && !r.error).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => r.error).length;

    return NextResponse.json({
      ok: true,
      processed,
      skipped,
      failed,
      results
    });
  } catch (err) {
    console.error("[cron/trend-scanners]", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

// GET alias — Vercel's cron uses GET by default.
export async function GET(request: NextRequest) {
  return POST(request);
}
