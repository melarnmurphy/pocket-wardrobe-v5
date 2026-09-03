import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock = vi.fn(() => ({ eq: eqMock, order: orderMock, maybeSingle: maybeSingleMock, error: null }));
const orderMock = vi.fn();
const maybeSingleMock = vi.fn();
const inMock = vi.fn(() => ({ eq: eqMock }));
const updateMock = vi.fn(() => ({ eq: eqMock }));
const selectMock = vi.fn(() => ({ eq: eqMock, in: inMock, order: orderMock, maybeSingle: maybeSingleMock }));
const fromMock = vi.fn((table: string) =>
  table === "profiles" ? { select: profilesSelectMock, update: updateMock } : { select: selectMock, update: updateMock }
);
const profilesSelectMock = vi.fn(() => ({ in: profilesInMock }));
const profilesInMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("hasLiveOfferOrHandover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, order: orderMock, maybeSingle: maybeSingleMock, error: null });
    orderMock.mockResolvedValue({ data: [], error: null });
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
  });

  it("reports no live offer or handover when there are none", async () => {
    const { hasLiveOfferOrHandover } = await import("@/lib/domain/local-threads/threads-service");
    const result = await hasLiveOfferOrHandover("22222222-2222-2222-2222-222222222222");

    expect(result).toEqual({ hasOffer: false, hasHandover: false, counterpartUserId: null });
  });
});

describe("listBlockedUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orderMock.mockResolvedValue({
      data: [{ blocked_id: "33333333-3333-3333-3333-333333333333", created_at: "2026-01-01T00:00:00Z" }],
      error: null
    });
    profilesInMock.mockResolvedValue({
      data: [{ user_id: "33333333-3333-3333-3333-333333333333", local_name: "sam" }],
      error: null
    });
  });

  it("returns the current user's blocked list", async () => {
    const { listBlockedUsers } = await import("@/lib/domain/local-threads/threads-service");
    const result = await listBlockedUsers();

    expect(fromMock).toHaveBeenCalledWith("user_blocks");
    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(profilesInMock).toHaveBeenCalledWith("user_id", ["33333333-3333-3333-3333-333333333333"]);
    expect(result).toEqual([
      { userId: "33333333-3333-3333-3333-333333333333", localName: "sam", blockedAt: "2026-01-01T00:00:00Z" }
    ]);
  });

  it("maps a blocked user with no profile row to a null local name", async () => {
    profilesInMock.mockResolvedValue({ data: [], error: null });

    const { listBlockedUsers } = await import("@/lib/domain/local-threads/threads-service");
    const result = await listBlockedUsers();

    expect(result).toEqual([
      { userId: "33333333-3333-3333-3333-333333333333", localName: null, blockedAt: "2026-01-01T00:00:00Z" }
    ]);
  });

  it("skips the profiles query when there are no blocked users", async () => {
    orderMock.mockResolvedValue({ data: [], error: null });

    const { listBlockedUsers } = await import("@/lib/domain/local-threads/threads-service");
    const result = await listBlockedUsers();

    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalledWith("profiles");
  });
});
