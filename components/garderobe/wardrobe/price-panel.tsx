"use client";

import { useActionState } from "react";
import { BottomSheet } from "@/components/garderobe/bottom-sheet";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";

type PricePanelProps = {
  garmentId: string;
  currentPrice: number | null;
  currentCurrency: string | null;
  mode: "sheet" | "panel";
  open?: boolean;
  onClose?: () => void;
  setPriceAction: (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;
};

const idleState: WardrobeActionState = { status: "idle", message: null };

/** 18a / w6b — "add or edit a price": a sheet on phone, a persistent side panel on desktop. */
export function PricePanel({
  garmentId,
  currentPrice,
  currentCurrency,
  mode,
  open = true,
  onClose,
  setPriceAction
}: PricePanelProps) {
  const [state, formAction] = useActionState(setPriceAction, idleState);

  const priceText =
    currentPrice === null
      ? "add later"
      : `${!currentCurrency || currentCurrency === "AUD" ? "A$" : `${currentCurrency} `}${currentPrice.toFixed(2)}`;

  const form = (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="text-[26px] font-light leading-[1.2] text-[var(--ink)]">
        {currentPrice === null ? (
          <span className="text-[var(--stone)]">{priceText}</span>
        ) : (
          priceText
        )}
      </div>
      <div className="flex items-end gap-2">
        <input type="hidden" name="garment_id" value={garmentId} />
        <input type="hidden" name="currency" value={currentCurrency ?? "AUD"} />
        <label className="flex-1">
          <span className="block pb-1 text-[11px] text-[var(--stone)]">
            amount, {currentCurrency ?? "AUD"}
          </span>
          <input
            type="number"
            name="price"
            step="0.01"
            min="0"
            defaultValue={currentPrice ?? ""}
            placeholder="add later"
            className="w-full rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
          />
        </label>
        <button
          type="submit"
          className="h-[38px] rounded-[100px] border border-[rgba(30,26,23,.22)] px-4 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--ink)]"
        >
          save
        </button>
      </div>
      {state.status === "error" ? (
        <p className="text-[11px] text-[var(--oxblood)]">{state.message}</p>
      ) : null}
    </form>
  );

  if (mode === "panel") {
    return <div>{form}</div>;
  }

  return (
    <BottomSheet open={open} onClose={onClose ?? (() => {})} title="price">
      {form}
    </BottomSheet>
  );
}
