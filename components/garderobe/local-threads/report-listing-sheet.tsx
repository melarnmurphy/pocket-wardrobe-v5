"use client";

import { useState } from "react";
import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";
import { PillButton } from "@/components/garderobe";

const REPORT_REASONS = [
  "fake or misleading",
  "inappropriate content",
  "unsafe or harassing behaviour",
  "spam",
  "something else"
] as const;

type ReportListingSheetProps = {
  open: boolean;
  onSubmit: (reason: string) => Promise<void>;
  onClose: () => void;
};

/**
 * Missing item, "report a listing / report a person". `blockUser` and
 * `reportListing` already exist server-side; this is their first UI. The
 * reporter's identity never reaches the reported person, so the sheet says
 * so up front rather than leaving it to be assumed.
 */
export function ReportListingSheet({ open, onSubmit, onClose }: ReportListingSheetProps) {
  const [selected, setSelected] = useState<(typeof REPORT_REASONS)[number] | null>(null);
  const [otherText, setOtherText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOther = selected === "something else";
  const canSubmit = selected !== null && (!isOther || otherText.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || !selected) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(isOther ? otherText.trim() : selected);
      onClose();
    } catch {
      setError("couldn't send that. try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="report this listing"
      description="tell us what's wrong. the other person is never told you reported them."
    >
      <div>
        {REPORT_REASONS.map((reason, index) => (
          <SheetAction key={reason} last={index === REPORT_REASONS.length - 1} onClick={() => setSelected(reason)}>
            {reason}
            {selected === reason ? " ✓" : ""}
          </SheetAction>
        ))}
      </div>
      {isOther ? (
        <textarea
          value={otherText}
          onChange={(event) => setOtherText(event.target.value.slice(0, 500))}
          rows={3}
          placeholder="what happened?"
          className="mt-3 w-full rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
        />
      ) : null}
      {error ? <p className="pt-2 text-[11px] text-[var(--oxblood)]">{error}</p> : null}
      <div className="pt-4">
        <PillButton disabled={!canSubmit || isSubmitting} onClick={handleSubmit}>
          {isSubmitting ? "sending…" : "send report"}
        </PillButton>
      </div>
    </BottomSheet>
  );
}
