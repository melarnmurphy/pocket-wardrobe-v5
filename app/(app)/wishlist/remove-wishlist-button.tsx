"use client";

import { X } from "lucide-react";
import { useTransition } from "react";
import { removeWishlistItemAction } from "./actions";

export function RemoveWishlistButton({ entryId, onRemoved }: { entryId: string; onRemoved: (entryId: string) => void }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label="remove"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await removeWishlistItemAction(entryId);
          if (result.status === "success") onRemoved(entryId);
        })
      }
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--stone)] disabled:opacity-50"
    >
      <X size={13} strokeWidth={1.5} />
    </button>
  );
}
