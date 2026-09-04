"use client";

import { useState } from "react";
import { followTrendAction, unfollowTrendAction } from "@/app/trends/actions";

export function FollowTrendButton({
  trendSignalId,
  initiallyFollowed
}: {
  trendSignalId: string;
  initiallyFollowed: boolean;
}) {
  const [followed, setFollowed] = useState(initiallyFollowed);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setIsPending(true);
    setError(null);
    const result = followed ? await unfollowTrendAction(trendSignalId) : await followTrendAction(trendSignalId);
    setIsPending(false);

    if (result.status === "error") {
      setError(result.message);
      return;
    }

    setFollowed(!followed);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={
          followed
            ? "rounded-full border border-[var(--oxblood)] bg-[var(--oxblood)] px-4 py-1.5 text-[12px] text-[var(--cream)]"
            : "rounded-full border border-[rgba(30,26,23,.3)] px-4 py-1.5 text-[12px] text-[var(--ink)]"
        }
      >
        {followed ? "following — notified when it fades" : "follow this trend"}
      </button>
      {error ? <p className="pt-1 text-[11px] text-[var(--oxblood)]">{error}</p> : null}
    </div>
  );
}
