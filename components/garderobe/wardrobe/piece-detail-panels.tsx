"use client";

import { useState } from "react";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";
import { PillButton } from "@/components/garderobe/pill-button";
import { DisposalSheet } from "./disposal-sheet";
import { RecutSheet } from "./recut-sheet";
import { WearCorrectionSheet } from "./wear-correction-sheet";

type ActionFn = (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;

// This file is the piece-detail page's client island: the page itself is a
// server component (see app/wardrobe/[id]/page.tsx), so anything here that
// needs to open/close a sheet — recutting the photo, disposing of a piece
// with a reason, or correcting a logged wear — is composed the same way
// ArchiveControl already is: a small "use client" wrapper that owns its own
// open state and receives the server actions as props.

type RecutControlProps = {
  garmentId: string;
  addImageAction: ActionFn;
};

/** 18d / w6c — trigger for RecutSheet: "recut the photo". */
export function RecutControl({ garmentId, addImageAction }: RecutControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12.5px] text-[var(--oxblood)] underline"
      >
        recut the photo
      </button>
      <RecutSheet
        open={open}
        garmentId={garmentId}
        onClose={() => setOpen(false)}
        addImageAction={addImageAction}
      />
    </>
  );
}

type DisposalControlProps = {
  garmentId: string;
  pieceName: string;
  archiveAction: ActionFn;
  undoAction: (garmentId: string) => Promise<void>;
};

/**
 * 18a / w6c — trigger for DisposalSheet: "let it go", capturing a reason
 * before archiving. Replaces the plain ArchiveControl submit button on the
 * piece-detail page so the "what happened to it?" reason is recorded.
 */
export function DisposalControl({ garmentId, pieceName, archiveAction, undoAction }: DisposalControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PillButton type="button" variant="secondary" onClick={() => setOpen(true)}>
        let it go
      </PillButton>
      <DisposalSheet
        open={open}
        garmentId={garmentId}
        onClose={() => setOpen(false)}
        archiveAction={archiveAction}
        pieceName={pieceName}
        undoAction={undoAction}
      />
    </>
  );
}

type WearHistoryEvent = {
  id: string;
  worn_at: string;
  occasion?: string | null;
};

type WearHistorySectionProps = {
  wearEvents: WearHistoryEvent[];
  updateAction: ActionFn;
  deleteAction: ActionFn;
};

/** 18a / w6b — recent wears, each opening WearCorrectionSheet to fix or remove it. */
export function WearHistorySection({ wearEvents, updateAction, deleteAction }: WearHistorySectionProps) {
  const [selected, setSelected] = useState<WearHistoryEvent | null>(null);

  if (!wearEvents.length) return null;

  return (
    <>
      <div className="flex flex-col gap-2">
        {wearEvents.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => setSelected(event)}
            className="flex items-center justify-between rounded-[4px] border border-[rgba(30,26,23,.14)] px-3 py-2 text-left text-[12.5px] text-[var(--ink)]"
          >
            <span>{new Date(event.worn_at).toLocaleDateString("en-AU")}</span>
            <span className="text-[var(--stone)]">{event.occasion ?? "—"}</span>
          </button>
        ))}
      </div>
      {selected ? (
        <WearCorrectionSheet
          open={Boolean(selected)}
          wearEventId={selected.id}
          wornAt={selected.worn_at}
          occasion={selected.occasion ?? null}
          onClose={() => setSelected(null)}
          updateAction={updateAction}
          deleteAction={deleteAction}
        />
      ) : null}
    </>
  );
}
