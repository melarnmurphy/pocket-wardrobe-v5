"use client";

import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";

type PickerSheetProps = {
  open: boolean;
  title: string;
  options: string[];
  value: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
};

/**
 * 18d / w6b — category, colour, and fabric all use this same picker pattern
 * (MODALS.md: "category and colour follow the same pattern" as fabric).
 */
export function PickerSheet({ open, title, options, value, onSelect, onClose }: PickerSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div>
        {options.map((option, index) => (
          <SheetAction
            key={option}
            last={index === options.length - 1}
            onClick={() => {
              onSelect(option);
              onClose();
            }}
          >
            {option}
            {option === value ? " ✓" : ""}
          </SheetAction>
        ))}
      </div>
    </BottomSheet>
  );
}
