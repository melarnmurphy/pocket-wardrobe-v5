/**
 * MODALS.md §3 — "notification permission", asked after the first wear log,
 * exactly once, ever, per browser, whichever way the user answers.
 *
 * These two pure helpers isolate the gating and flag-setting logic from
 * `GarmentDetailDialog` in components/wardrobe-shop.tsx so it can be unit
 * tested without rendering the whole dialog tree.
 */

const PROMPTED_FLAG = "gw.notificationPermissionPrompted";

/**
 * True only when it is appropriate to show the notification-permission
 * dialog: the user has not already been asked (in this browser, ever,
 * regardless of how they answered), the Notification API exists, and the
 * browser has not already resolved the permission one way or the other.
 */
export function shouldPromptForNotificationPermission(): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (window.localStorage.getItem(PROMPTED_FLAG) === "1") return false;
  } catch {
    // Treat an inaccessible localStorage (e.g. Safari with site data blocked)
    // as "flag not set" — the conservative default is to show the dialog.
  }

  if (typeof window.Notification === "undefined") return false;
  if (window.Notification.permission !== "default") return false;

  return true;
}

/**
 * Records that the user has been asked, so the dialog never appears again
 * in this browser — called on both "turn on" and "not now", unlike the
 * photo-library permission dialog, which only records an allow.
 */
export function markNotificationPermissionPrompted(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PROMPTED_FLAG, "1");
  } catch {
    // Best-effort persistence only; a thrown write just means the dialog
    // may show again next session, which is safe.
  }
}
