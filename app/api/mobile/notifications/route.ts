import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "@/lib/domain/notifications/service";

export const dynamic = "force-dynamic";

const NOTIFICATIONS_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const ctx = { supabase, userId: user.id };

    const [notifications, unreadCount] = await Promise.all([
      listNotifications(NOTIFICATIONS_LIMIT, ctx),
      countUnreadNotifications(ctx)
    ]);

    return NextResponse.json({ notifications, unread_count: unreadCount });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load notifications" },
      { status: 500 }
    );
  }
}

const markReadInputSchema = z.union([
  z.object({ notification_id: z.string().uuid() }),
  z.object({ mark_all: z.literal(true) })
]);

// Handles both a mark-one ({ notification_id }) and a mark-all
// ({ mark_all: true }) request body. Exposed as both PATCH (the semantically
// correct verb for a partial update) and POST, since MobileAPIClient (the
// iOS client every store already uses) only speaks GET/POST.
async function markRead(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const ctx = { supabase, userId: user.id };

    const rawInput = await request.json();
    const parsed = markReadInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    if ("mark_all" in parsed.data) {
      await markAllNotificationsRead(ctx);
    } else {
      await markNotificationRead(parsed.data.notification_id, ctx);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update notification" },
      { status: 500 }
    );
  }
}

export const PATCH = markRead;
export const POST = markRead;
