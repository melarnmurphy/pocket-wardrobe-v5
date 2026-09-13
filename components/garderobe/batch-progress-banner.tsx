"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type BatchProgressBannerProps = {
  batchId: string;
  doneCount: number;
  totalCount: number;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
};

/** Polls a photo batch and refreshes the server component when progress changes. */
export function BatchProgressBanner({ batchId, doneCount, totalCount, status }: BatchProgressBannerProps) {
  const router = useRouter();
  const [progress, setProgress] = useState({ doneCount, status });
  const terminalRefreshRequested = useRef(false);

  useEffect(() => {
    setProgress({ doneCount, status });
    terminalRefreshRequested.current = false;
  }, [batchId, doneCount, status]);

  useEffect(() => {
    if (progress.status !== "running") return;

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/pipeline/batch/${batchId}`, { cache: "no-store" });
        if (!response.ok) return;
        const batch = (await response.json()) as { done_count: number; status: string };

        setProgress({ doneCount: batch.done_count, status: batch.status as BatchProgressBannerProps["status"] });

        // Keep progress updates local. Re-render the server payload once at the
        // end so the new drafts are loaded without repeatedly refreshing the
        // whole app shell every 1.5 seconds.
        if (batch.status !== "running" && !terminalRefreshRequested.current) {
          terminalRefreshRequested.current = true;
          router.refresh();
        }
      } catch {
        // transient network error — try again on the next tick
      }
    }, 1500);

    return () => window.clearInterval(interval);
  }, [batchId, progress.status, router]);

  if (progress.status !== "running") return null;

  const pct = totalCount > 0 ? Math.round((progress.doneCount / totalCount) * 100) : 0;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-[4px] border border-[rgba(30,26,23,.11)] bg-[var(--paper)] px-4 py-3">
      <span className="gw-spin h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-[var(--oxblood)]" />
      <div className="flex-1">
        <p className="text-[12.5px] text-[var(--slate)]">
          reading {progress.doneCount} of {totalCount} photos — the rest keep going even if you leave
        </p>
        <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-[2px] bg-[rgba(30,26,23,.11)]">
          <div
            className="gw-grow h-full rounded-[2px] bg-[var(--oxblood)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
