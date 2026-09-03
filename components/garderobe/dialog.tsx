"use client";

import type { ReactNode } from "react";
import { PillButton } from "./pill-button";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  onConfirm: () => void;
  confirmVariant?: "primary" | "on-blush";
  hideCancel?: boolean;
};

/** The centred dialog primitive: 14px radius, 22px inset, two buttons maximum. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  cancelLabel = "cancel",
  confirmLabel,
  onConfirm,
  confirmVariant = "primary",
  hideCancel = false
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-5">
      <button
        type="button"
        aria-label="dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(12,10,9,.55)]"
      />
      <div className="gw-pop relative w-full max-w-[340px] rounded-[14px] bg-[var(--cream)] px-[22px] py-6 text-center">
        {icon ? (
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--blush)] text-[var(--blush-ink)]">
            {icon}
          </div>
        ) : null}
        <div className="text-[21px] font-light leading-[1.25] text-[var(--ink)]">{title}</div>
        {description ? (
          <div className="px-0 py-[10px] pb-5 text-[12.5px] leading-[1.5] text-[var(--stone)]">
            {description}
          </div>
        ) : null}
        <div className="flex gap-[9px] pt-1">
          {!hideCancel ? (
            <PillButton variant="secondary" onClick={onClose} className="h-11">
              {cancelLabel}
            </PillButton>
          ) : null}
          <PillButton variant={confirmVariant} onClick={onConfirm} className="h-11">
            {confirmLabel}
          </PillButton>
        </div>
      </div>
    </div>
  );
}
