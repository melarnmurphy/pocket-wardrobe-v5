import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import {
  NOTIFICATION_KIND_VALUES,
  notificationSchema,
  type AppNotification
} from "@/lib/domain/notifications";

type NotificationKind = (typeof NOTIFICATION_KIND_VALUES)[number];
import type { TablesInsert } from "@/types/database";

type NotificationInsert = TablesInsert<"app_notifications">;

const SELECT = "id,kind,title,body,subject_kind,subject_id,created_at,read_at";

export async function listNotifications(limit = 20): Promise<AppNotification[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("app_notifications")
    .select(SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return z.array(notificationSchema).parse(data ?? []);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(notificationId);

  const { error } = await supabase
    .from("app_notifications")
    .update({ read_at: new Date().toISOString() } as never)
    .eq("id", parsedId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("app_notifications")
    .update({ read_at: new Date().toISOString() } as never)
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Server-to-server write, called from wherever a real trigger happens (so
 * far: a new local-threads message — see
 * lib/domain/local-threads/threads-service.ts's insertMessage). Deliberately
 * not exposed as a user-callable action.
 */
export async function createNotification(params: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  subjectKind?: "piece" | "wishlist" | "listing" | "trend" | "batch" | "thread";
  subjectId?: string;
}): Promise<void> {
  const supabase = await createClient();

  const insert: NotificationInsert = {
    user_id: params.userId,
    kind: params.kind,
    title: params.title,
    body: params.body,
    subject_kind: params.subjectKind ?? null,
    subject_id: params.subjectId ?? null
  };

  await supabase.from("app_notifications").insert(insert as never);
}
