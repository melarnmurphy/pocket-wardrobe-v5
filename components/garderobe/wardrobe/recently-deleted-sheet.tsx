"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/garderobe/bottom-sheet";
import { PillButton } from "@/components/garderobe/pill-button";
import { showAppToast } from "@/lib/ui/app-toast";
import {
  wardrobeActionState,
  type WardrobeActionState
} from "@/lib/domain/wardrobe/action-state";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";

type RestoreAction = (
  state: WardrobeActionState,
  formData: FormData
) => Promise<WardrobeActionState>;

type RecentlyDeletedSheetProps = {
  open: boolean;
  items: GarmentListItem[];
  onClose: () => void;
  restoreAction: RestoreAction;
};

/** 18b / w6c — "recently deleted / restore". */
export function RecentlyDeletedSheet({ open, items, onClose, restoreAction }: RecentlyDeletedSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="recently deleted">
      {items.length === 0 ? (
        <p className="py-4 text-[12.5px] text-[var(--stone)]">
          nothing recently deleted
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <RecentlyDeletedRow key={item.id} item={item} restoreAction={restoreAction} />
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}

function RecentlyDeletedRow({
  item,
  restoreAction
}: {
  item: GarmentListItem;
  restoreAction: RestoreAction;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(restoreAction, wardrobeActionState);

  useEffect(() => {
    if (state.status === "success") {
      showAppToast({
        message: state.message || "Restored to the wardrobe.",
        tone: "success"
      });
      router.refresh();
    }
  }, [state.status, state.message, router]);

  return (
    <li className="flex items-center justify-between border-b border-[rgba(30,26,23,.11)] py-2">
      <span className="text-[14.5px] text-[var(--ink)]">{item.title || item.category}</span>
      <form action={formAction}>
        <input type="hidden" name="garment_id" value={item.id} />
        <PillButton
          type="submit"
          variant="secondary"
          fullWidth={false}
          className="h-8 px-3 text-[11px]"
        >
          restore
        </PillButton>
      </form>
      {state.status === "error" ? (
        <p className="pt-1 text-[11px] text-[var(--oxblood)]">{state.message}</p>
      ) : null}
    </li>
  );
}
