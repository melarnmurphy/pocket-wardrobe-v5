"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
};

/** The bottom sheet primitive: 20px top corners, grab handle, cream ground. */
export function BottomSheet({ open, onClose, title, description, children }: BottomSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <button
        type="button"
        aria-label="dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(12,10,9,.55)]"
      />
      <div className="gw-pop relative w-full max-w-md rounded-t-[20px] bg-[var(--cream)] px-5 pb-[22px] pt-4">
        <div className="mx-auto mb-4 h-[3px] w-[38px] rounded-full bg-[rgba(30,26,23,.15)]" />
        <div className="text-[21px] font-light leading-[1.1] text-[var(--ink)]">{title}</div>
        {description ? (
          <div className="py-2 pb-[14px] text-[12.5px] leading-[1.5] text-[var(--stone)]">
            {description}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

type SheetActionProps = {
  onClick?: () => void;
  destructive?: boolean;
  last?: boolean;
  children: ReactNode;
};

export function SheetAction({ onClick, destructive = false, last = false, children }: SheetActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center justify-between py-[13px] text-left text-[14.5px]",
        last ? "" : "border-b border-[rgba(30,26,23,.11)]",
        destructive ? "text-[var(--oxblood)]" : "text-[var(--ink)]"
      ].join(" ")}
    >
      <span>{children}</span>
      {!destructive ? <ChevronRight size={15} strokeWidth={1.5} className="text-[var(--stone)]" /> : null}
    </button>
  );
}
