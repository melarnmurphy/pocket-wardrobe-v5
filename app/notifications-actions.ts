"use server";

import {
  listNotifications,
  markAllNotificationsRead
} from "@/lib/domain/notifications/service";
import type { AppNotification } from "@/lib/domain/notifications";

export async function listNotificationsAction(): Promise<AppNotification[]> {
  try {
    return await listNotifications();
  } catch {
    return [];
  }
}

export async function markAllNotificationsReadAction(): Promise<void> {
  await markAllNotificationsRead();
}
