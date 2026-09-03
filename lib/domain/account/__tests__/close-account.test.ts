import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
const deleteUser = vi.fn();
const signOut = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from, auth: { signOut } }))
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ auth: { admin: { deleteUser } } }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));
vi.mock("@/lib/domain/local-threads/threads-service", () => ({
  listMyThreads: vi.fn(),
  withdrawLocalListing: vi.fn(async () => undefined)
}));

describe("getAccountClosureBlockers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts live listings and open threads", async () => {
    const { listMyThreads } = await import("@/lib/domain/local-threads/threads-service");
    (listMyThreads as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "t1", state: "open" },
      { id: "t2", state: "handover arranged" },
      { id: "t3", state: "completed" }
    ]);

    const inFn = vi.fn().mockResolvedValue({
      data: [{ id: "l1" }, { id: "l2" }],
      error: null
    });
    const eqFn = vi.fn(() => ({ in: inFn }));
    const selectFn = vi.fn(() => ({ eq: eqFn }));
    from.mockReturnValue({ select: selectFn });

    const { getAccountClosureBlockers } = await import("@/lib/domain/account/service");
    const blockers = await getAccountClosureBlockers();

    expect(blockers.liveListingCount).toBe(2);
    expect(blockers.liveListingIds).toEqual(["l1", "l2"]);
    expect(blockers.openThreadCount).toBe(2);
    expect(eqFn).toHaveBeenCalledWith("seller_id", "11111111-1111-1111-1111-111111111111");
    expect(inFn).toHaveBeenCalledWith("status", ["live", "reserved", "handover arranged"]);
  });
});

describe("closeUserAccount", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { listMyThreads } = await import("@/lib/domain/local-threads/threads-service");
    (listMyThreads as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("withdraws every live listing, then deletes the auth user, then signs out the browser session", async () => {
    const inFn = vi.fn().mockResolvedValue({ data: [{ id: "l1" }, { id: "l2" }], error: null });
    const eqFn = vi.fn(() => ({ in: inFn }));
    const selectFn = vi.fn(() => ({ eq: eqFn }));
    from.mockReturnValue({ select: selectFn });
    deleteUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });

    const { closeUserAccount } = await import("@/lib/domain/account/service");
    const { withdrawLocalListing } = await import("@/lib/domain/local-threads/threads-service");
    await closeUserAccount();

    expect(withdrawLocalListing).toHaveBeenCalledWith("l1");
    expect(withdrawLocalListing).toHaveBeenCalledWith("l2");
    expect(deleteUser).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
    expect(signOut).toHaveBeenCalled();
  });

  it("throws if the auth user deletion fails", async () => {
    const inFn = vi.fn().mockResolvedValue({ data: [], error: null });
    from.mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => ({ in: inFn })) })) });
    deleteUser.mockResolvedValue({ error: { message: "boom" } });

    const { closeUserAccount } = await import("@/lib/domain/account/service");
    await expect(closeUserAccount()).rejects.toThrow("boom");
    expect(signOut).not.toHaveBeenCalled();
  });
});
