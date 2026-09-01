import { z } from "zod";

export const NOTIFICATION_KIND_VALUES = [
  "price drop",
  "trend expiry",
  "offer",
  "sold",
  "orders waiting",
  "receipt read",
  "wear reminder",
  "batch finished",
  "message"
] as const;

export const notificationSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(NOTIFICATION_KIND_VALUES),
  title: z.string(),
  body: z.string(),
  subject_kind: z.enum(["piece", "wishlist", "listing", "trend", "batch", "thread"]).nullable(),
  subject_id: z.string().uuid().nullable(),
  created_at: z.string(),
  read_at: z.string().nullable()
});
export type AppNotification = z.infer<typeof notificationSchema>;
