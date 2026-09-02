"use client";

import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";

// Values must match components/wardrobe-shop.tsx's `switch (sortBy)` block
// exactly — this sheet drives that existing sort logic rather than
// introducing a second, divergent set of sort keys.
const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "newest", label: "newest first" },
  { value: "neglected", label: "neglected value" },
  { value: "cost_desc", label: "cost per wear: high to low" },
  { value: "cost_asc", label: "cost per wear: low to high" },
  { value: "favourites", label: "favourites first" },
  { value: "most_worn", label: "most worn" },
  { value: "price_desc", label: "price: high to low" }
];

type SortSheetProps = {
  open: boolean;
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

/** 18c — sort as a sheet on phone; desktop keeps the existing inline FilterSelect. */
export function SortSheet({ open, value, onSelect, onClose }: SortSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="sort">
      {SORT_OPTIONS.map((option, index) => (
        <SheetAction
          key={option.value}
          last={index === SORT_OPTIONS.length - 1}
          onClick={() => {
            onSelect(option.value);
            onClose();
          }}
        >
          {option.label}
          {option.value === value ? " ✓" : ""}
        </SheetAction>
      ))}
    </BottomSheet>
  );
}
