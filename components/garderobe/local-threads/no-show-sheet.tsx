"use client";

import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";

type NoShowSheetProps = {
  open: boolean;
  counterpartName: string;
  placeName: string;
  at: string;
  onReport: () => void;
  onClose: () => void;
};

/** Missing item, "they didn't show", the only trust signal the marketplace has. */
export function NoShowSheet({ open, counterpartName, placeName, at, onReport, onClose }: NoShowSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="they didn't show?"
      description={`${counterpartName} was due at ${placeName} on ${new Date(at).toLocaleString("en-AU")}.`}
    >
      <div>
        <SheetAction onClick={onClose}>give it a bit longer</SheetAction>
        <SheetAction destructive last onClick={onReport}>
          they didn&apos;t show
        </SheetAction>
      </div>
    </BottomSheet>
  );
}
