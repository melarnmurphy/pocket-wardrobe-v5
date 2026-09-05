import { beforeEach, describe, expect, it, vi } from "vitest";

const getRequiredUser = vi.fn();

// listNotifications: .from("app_notifications").select().eq().order().limit()
const listLimit = vi.fn();
const listOrder = vi.fn(() => ({ limit: listLimit }));
const listEq = vi.fn(() => ({ order: listOrder }));
const listSelect = vi.fn((_columns: string) => ({ eq: listEq }));

// countUnreadNotifications: .from(...).select(_, {count, head}).eq().is()
const countIs = vi.fn();
const countEq = vi.fn(() => ({ is: countIs }));
const countSelect = vi.fn((_columns: string, _opts?: { count?: string; head?: boolean }) => ({
  eq: countEq
}));

// markNotificationRead: .from(...).update().eq().eq()
const markOneEq2 = vi.fn();
const markOneEq1 = vi.fn(() => ({ eq: markOneEq2 }));
const markOneUpdate = vi.fn(() => ({ eq: markOneEq1 }));

// markAllNotificationsRead: .from(...).update().eq().is()
const markAllIs = vi.fn();
const markAllEq = vi.fn(() => ({ is: markAllIs }));
const markAllUpdate = vi.fn(() => ({ eq: markAllEq }));

const from = vi.fn((table: string): Record<string, unknown> => {
  if (table !== "app_notifications") {
    throw new Error(`Unexpected table ${table}`);
  }
  return {
    select: (columns: string, opts?: { count?: string; head?: boolean }) =>
      opts?.head ? countSelect(columns, opts) : listSelect(columns),
    update: (values: unknown) => {
      // Distinguish the two update call sites by which chain the test wired
      // up to respond — both share the same shape, so route through a
      // single update mock and let the test pick which branch it exercises.
      return updateRouter(values);
    }
  };
});

// A single seam both markNotificationRead and markAllNotificationsRead's
// .update(...) calls go through; each test sets which chain applies.
const updateRouter = vi.fn();

vi.mock("@/lib/auth", () => ({
  getRequiredUser
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from })
}));

const userId = "11111111-1111-4111-8111-111111111111";
const ctx = { supabase: { from } as never, userId };

beforeEach(() => {
  vi.clearAllMocks();
  getRequiredUser.mockResolvedValue({ id: userId });
  listLimit.mockResolvedValue({ data: [], error: null });
  countIs.mockResolvedValue({ count: 0, error: null });
  updateRouter.mockImplementation(() => ({ eq: markOneEq1 }));
  markOneEq2.mockResolvedValue({ error: null });
  markAllIs.mockResolvedValue({ error: null });
});

describe("listNotifications", () => {
  it("uses the cookie-based user/client when no ctx is passed", async () => {
    const { listNotifications } = await import("@/lib/domain/notifications/service");

    await listNotifications();

    expect(getRequiredUser).toHaveBeenCalledTimes(1);
    expect(listEq).toHaveBeenCalledWith("user_id", userId);
  });

  it("uses the passed ctx's userId/supabase instead of the cookie session", async () => {
    const { listNotifications } = await import("@/lib/domain/notifications/service");

    await listNotifications(20, ctx);

    expect(getRequiredUser).not.toHaveBeenCalled();
    expect(listEq).toHaveBeenCalledWith("user_id", userId);
    expect(listLimit).toHaveBeenCalledWith(20);
  });
});

describe("countUnreadNotifications", () => {
  it("counts unread rows for the ctx user without touching the cookie session", async () => {
    countIs.mockResolvedValue({ count: 3, error: null });
    const { countUnreadNotifications } = await import("@/lib/domain/notifications/service");

    const result = await countUnreadNotifications(ctx);

    expect(getRequiredUser).not.toHaveBeenCalled();
    expect(countEq).toHaveBeenCalledWith("user_id", userId);
    expect(countIs).toHaveBeenCalledWith("read_at", null);
    expect(result).toBe(3);
  });
});

describe("markNotificationRead", () => {
  it("scopes the update to the ctx user's own row", async () => {
    const { markNotificationRead } = await import("@/lib/domain/notifications/service");
    const notificationId = "22222222-2222-4222-8222-222222222222";

    await markNotificationRead(notificationId, ctx);

    expect(getRequiredUser).not.toHaveBeenCalled();
    expect(markOneEq1).toHaveBeenCalledWith("id", notificationId);
    expect(markOneEq2).toHaveBeenCalledWith("user_id", userId);
  });
});

describe("markAllNotificationsRead", () => {
  it("marks every unread row for the ctx user", async () => {
    updateRouter.mockImplementation(() => ({ eq: markAllEq }));
    const { markAllNotificationsRead } = await import("@/lib/domain/notifications/service");

    await markAllNotificationsRead(ctx);

    expect(getRequiredUser).not.toHaveBeenCalled();
    expect(markAllEq).toHaveBeenCalledWith("user_id", userId);
    expect(markAllIs).toHaveBeenCalledWith("read_at", null);
  });
});
