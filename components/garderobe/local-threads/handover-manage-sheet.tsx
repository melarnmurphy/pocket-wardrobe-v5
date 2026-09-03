"use client";

import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";

type HandoverManageSheetProps = {
  open: boolean;
  placeName: string;
  placeSuburb: string;
  at: string;
  onReschedule: () => void;
  onCancel: () => void;
  onClose: () => void;
};

/** Missing item, "cancel or reschedule a handover". */
export function HandoverManageSheet({
  open,
  placeName,
  placeSuburb,
  at,
  onReschedule,
  onCancel,
  onClose
}: HandoverManageSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="this handover"
      description={`${placeName}, ${placeSuburb} · ${new Date(at).toLocaleString("en-AU")}`}
    >
      <div>
        <SheetAction onClick={onReschedule}>reschedule</SheetAction>
        <SheetAction destructive last onClick={onCancel}>
          cancel handover
        </SheetAction>
      </div>
    </BottomSheet>
  );
}
