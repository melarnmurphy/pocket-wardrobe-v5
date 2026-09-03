"use client";

import { Dialog } from "@/components/garderobe/dialog";

type BlockUserDialogProps = {
  open: boolean;
  counterpartName: string;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Missing item, "block, confirm". Replaces the raw confirm() in
 * thread-view.tsx. Blocking is mutual and immediate: it closes any open
 * thread between the two people, and their listings stop appearing in
 * each other's feed via RLS (local_listings_select_live_or_own, migration
 * 031). Nothing notifies the blocked person, so it is safe to use without
 * fear of retaliation, and that is stated here rather than left implicit.
 */
export function BlockUserDialog({ open, counterpartName, onConfirm, onClose }: BlockUserDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`block ${counterpartName}?`}
      description="ends this thread for both of you and hides their listings from your feed. they won't be told."
      confirmLabel="block"
      onConfirm={onConfirm}
    />
  );
}
