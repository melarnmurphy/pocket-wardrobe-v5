"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { acceptDraftAction, rejectDraftAction } from "./actions";
import type { PendingDraft } from "@/lib/domain/ingestion/service";

interface Props {
  drafts: PendingDraft[];
}

export default function DraftReviewList({ drafts }: Props) {
  const router = useRouter();
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  const remaining = drafts.filter((d) => !actionedIds.has(d.id));

  function markActioned(id: string) {
    setActionedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  // Redirect to wardrobe when all drafts have been actioned
  useEffect(() => {
    if (drafts.length > 0 && actionedIds.size === drafts.length) {
      router.push("/wardrobe");
    }
  }, [actionedIds, drafts.length, router]);

  function handleAccept(draftId: string) {
    setPendingId(draftId);
    acceptDraftAction(draftId).then((result) => {
      setPendingId(null);
      if (result.status === "error") {
        setErrors((prev) => ({ ...prev, [draftId]: result.message }));
      } else {
        markActioned(draftId);
      }
    });
  }

  function handleReject(draftId: string) {
    setPendingId(draftId);
    rejectDraftAction(draftId).then((result) => {
      setPendingId(null);
      if (result.status === "error") {
        setErrors((prev) => ({ ...prev, [draftId]: result.message }));
      } else {
        markActioned(draftId);
      }
    });
  }

  if (remaining.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--muted)]">No pending drafts.</p>
        <a href="/" className="mt-4 text-sm text-[var(--accent)] underline">
          Upload a photo to get started
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {remaining.map((draft) => {
        const isLowConfidence = draft.payload.confidence < 0.6;
        const error = errors[draft.id];

        return (
          <div
            key={draft.id}
            className="grid grid-cols-[80px_1fr_auto] gap-4 rounded-[18px] border border-[var(--line)] bg-white p-5"
            style={{ opacity: isLowConfidence ? 0.85 : 1 }}
          >
            {/* Placeholder image */}
            <div className="h-[100px] w-[80px] rounded-xl bg-[#e8e0d8]" />

            {/* Garment details */}
            <div>
              <p className="mb-1.5 text-[15px] font-semibold text-[#1a1a1a]">
                {draft.payload.tag}
              </p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ["category", draft.payload.category],
                    ["colour", draft.payload.colour],
                    ["material", draft.payload.material],
                    ["style", draft.payload.style],
                  ] as [string, string | null][]
                )
                  .filter(([, value]) => Boolean(value))
                  .map(([field, value]) => (
                    <span
                      key={field}
                      className="rounded-full bg-[#f0ece5] px-2.5 py-0.5 text-[11px] text-[#666]"
                    >
                      {value}
                    </span>
                  ))}
              </div>
              <p
                className={`text-[11px] ${isLowConfidence ? "text-[#e09060]" : "text-[#aaa]"}`}
              >
                Confidence: {Math.round(draft.payload.confidence * 100)}%
                {isLowConfidence && " · low confidence"}
              </p>
              {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleAccept(draft.id)}
                disabled={pendingId === draft.id}
                className="rounded-full bg-[#c17a3a] px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => handleReject(draft.id)}
                disabled={pendingId === draft.id}
                className="rounded-full border border-[var(--line)] px-5 py-2 text-xs text-[#999] disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
