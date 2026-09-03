"use client";

import { Dialog } from "@/components/garderobe/dialog";

type NotificationPermissionDialogProps = {
  open: boolean;
  onTurnOn: () => void;
  onNotNow: () => void;
};

/**
 * MODALS.md §3 — "notification permission", asked after the first wear log
 * per the settings copy (DATA_MODEL.md User.notifications.wearReminders).
 * There is no notification-settings screen built yet (phase 10 only shipped
 * the in-app notification feed), so "any time from account settings" here
 * is aspirational copy pointing at a screen a future phase still owes.
 */
export function NotificationPermissionDialog({ open, onTurnOn, onNotNow }: NotificationPermissionDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onNotNow}
      title="a nudge to wear it again?"
      description="Garderobe can remind you about pieces sitting unworn, and you can turn it off any time from account settings."
      cancelLabel="not now"
      confirmLabel="turn on"
      onConfirm={onTurnOn}
    />
  );
}
