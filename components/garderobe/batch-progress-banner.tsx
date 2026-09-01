"use client";

import { useEffect, useRef } from "react";
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
  const lastDoneCount = useRef(doneCount);

  useEffect(() => {
    if (status !== "running") return;

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/pipeline/batch/${batchId}`, { cache: "no-store" });
        if (!response.ok) return;
        const batch = (await response.json()) as { done_count: number; status: string };

        if (batch.done_count !== lastDoneCount.current || batch.status !== "running") {
          lastDoneCount.current = batch.done_count;
          router.refresh();
        }
      } catch {
        // transient network error — try again on the next tick
      }
    }, 1500);

    return () => window.clearInterval(interval);
  }, [batchId, status, router]);

  if (status !== "running") return null;

  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-[4px] border border-[rgba(30,26,23,.11)] bg-[var(--paper)] px-4 py-3">
      <span className="gw-spin h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-[var(--oxblood)]" />
      <div className="flex-1">
        <p className="text-[12.5px] text-[var(--slate)]">
          reading {doneCount} of {totalCount} photos — the rest keep going even if you leave
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
