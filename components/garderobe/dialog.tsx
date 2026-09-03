"use client";

import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { PillButton } from "./pill-button";

type DialogConfirmProps =
  | { onConfirm: () => void; confirmHref?: never }
  | { onConfirm?: never; confirmHref: string };

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  confirmVariant?: "primary" | "on-blush";
} & DialogConfirmProps;

const CONFIRM_LINK_CLASSES: Record<"primary" | "on-blush", string> = {
  primary: "bg-[var(--oxblood)] text-[var(--cream)]",
  "on-blush": "bg-[var(--blush)] text-[var(--blush-ink)]"
};

/**
 * The centred dialog primitive: 14px radius, 22px inset, two buttons maximum.
 *
 * The confirm side is a `PillButton` by default. Pass `confirmHref` instead
 * of `onConfirm` when the confirm action needs to be a real link (so
 * back/forward navigation and open-in-new-tab work) rather than a
 * click-handler-only button; it renders styled identically to the button it
 * replaces.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  cancelLabel = "cancel",
  confirmLabel,
  onConfirm,
  confirmHref,
  confirmVariant = "primary"
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
          <PillButton
            variant="secondary"
            onClick={onClose}
            fullWidth={!confirmHref}
            className={confirmHref ? "h-11 flex-1" : "h-11"}
          >
            {cancelLabel}
          </PillButton>
          {confirmHref ? (
            <Link
              href={confirmHref as Route}
              className={[
                "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[100px] px-6",
                "font-semibold text-[9.5px] uppercase tracking-[.2em]",
                "transition-transform duration-150 ease-out active:scale-[.98]",
                CONFIRM_LINK_CLASSES[confirmVariant]
              ].join(" ")}
            >
              {confirmLabel}
            </Link>
          ) : (
            <PillButton variant={confirmVariant} onClick={onConfirm} className="h-11">
              {confirmLabel}
            </PillButton>
          )}
        </div>
      </div>
    </div>
  );
}
