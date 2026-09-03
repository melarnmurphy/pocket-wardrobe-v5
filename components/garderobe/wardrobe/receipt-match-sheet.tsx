"use client";

import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";

type PriceMatchCandidate = { garment_id: string; title: string | null; category: string };

type ReceiptMatchSheetProps = {
  open: boolean;
  candidates: PriceMatchCandidate[];
  onClose: () => void;
  onResolve: (garmentId: string | null) => void;
  pending: boolean;
  error: string | null;
};

/**
 * MODALS.md §3 — "this receipt matches three pieces": the resolver for an
 * ambiguous price. Never pre-selects a candidate (standing rule 5) — every
 * option, including "none of these," is an equally weighted choice.
 */
export function ReceiptMatchSheet({
  open,
  candidates,
  onClose,
  onResolve,
  pending,
  error
}: ReceiptMatchSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`this receipt matches ${candidates.length} pieces`}
      description="It might be the price for one of these already in your wardrobe. Choose which, or add it as something new."
    >
      <div>
        {candidates.map((candidate) => (
          <SheetAction
            key={candidate.garment_id}
            last={false}
            onClick={() => onResolve(candidate.garment_id)}
          >
            {candidate.title || candidate.category}
          </SheetAction>
        ))}
        <SheetAction last onClick={() => onResolve(null)}>
          none of these, add as new
        </SheetAction>
      </div>
      {pending ? <p className="pt-3 text-[11px] text-[var(--stone)]">saving…</p> : null}
      {error ? <p className="pt-3 text-[11px] text-[var(--oxblood)]">{error}</p> : null}
    </BottomSheet>
  );
}
