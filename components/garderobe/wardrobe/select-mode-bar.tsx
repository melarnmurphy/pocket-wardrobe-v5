"use client";

type SelectModeBarProps = {
  selectedCount: number;
  onRequestDelete: () => void;
  onRequestNewCollection: () => void;
  onExit: () => void;
};

/** 18c / w6a — select mode's bulk-action bar. */
export function SelectModeBar({
  selectedCount,
  onRequestDelete,
  onRequestNewCollection,
  onExit
}: SelectModeBarProps) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-between gap-3 border-t border-[rgba(30,26,23,.14)] bg-[var(--cream)] px-5 py-3">
      <span className="text-[12.5px] text-[var(--slate)]">{selectedCount} selected</span>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onRequestNewCollection}
          disabled={!hasSelection}
          className="text-[12.5px] text-[var(--ink)] disabled:opacity-40"
        >
          new collection
        </button>
        <button
          type="button"
          onClick={onRequestDelete}
          disabled={!hasSelection}
          className="text-[12.5px] text-[var(--oxblood)] disabled:opacity-40"
        >
          delete {selectedCount}
        </button>
        <button type="button" onClick={onExit} className="text-[12.5px] text-[var(--stone)]">
          done
        </button>
      </div>
    </div>
  );
}
