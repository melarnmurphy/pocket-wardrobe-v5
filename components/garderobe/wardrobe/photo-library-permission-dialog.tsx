"use client";

import { Dialog } from "@/components/garderobe/dialog";

type PhotoLibraryPermissionDialogProps = {
  open: boolean;
  onAllow: () => void;
  onNotNow: () => void;
};

/**
 * MODALS.md §3 — "photo library permission": camera is drawn (7a), the
 * library is not, and batch add starts there. Same visual pattern as the
 * drawn camera dialog: one-sentence trade, "not now" / "allow" pair
 * (standing rule 4).
 */
export function PhotoLibraryPermissionDialog({ open, onAllow, onNotNow }: PhotoLibraryPermissionDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onNotNow}
      title="garderobe needs your photos"
      description="Choosing from your library starts a batch that only joins the wardrobe once you've reviewed and confirmed each piece."
      cancelLabel="not now"
      confirmLabel="allow access"
      onConfirm={onAllow}
    />
  );
}
