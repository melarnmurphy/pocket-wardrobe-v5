import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

const maybeSingleMock = vi.fn();
const eqMock = vi.fn((): any => ({ eq: eqMock, error: null, maybeSingle: maybeSingleMock }));
const updateMock = vi.fn(() => ({ eq: eqMock }));
const selectMock = vi.fn(() => ({ eq: eqMock, maybeSingle: maybeSingleMock }));
const fromMock = vi.fn(() => ({ update: updateMock, select: selectMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => {}) }));

describe("cancelHandover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null, maybeSingle: maybeSingleMock });
    maybeSingleMock.mockResolvedValue({
      data: { thread_id: "22222222-2222-2222-2222-222222222222", state: "agreed" },
      error: null
    });
  });

  it("sets the handover state to cancelled and reopens the thread", async () => {
    const { cancelHandover } = await import("@/lib/domain/local-threads/threads-service");
    await cancelHandover("33333333-3333-3333-3333-333333333333");

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ state: "cancelled" }));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ state: "open" }));
  });

  it("rejects an already-terminal handover", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { thread_id: "22222222-2222-2222-2222-222222222222", state: "completed" },
      error: null
    });

    const { cancelHandover } = await import("@/lib/domain/local-threads/threads-service");
    await expect(cancelHandover("33333333-3333-3333-3333-333333333333")).rejects.toThrow(
      "This handover has already been cancelled."
    );
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("reportNoShow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null, maybeSingle: maybeSingleMock });
  });

  function mockHandoverAndThread(
    handoverState: string,
    thread: { buyer_id: string; seller_id: string } | null
  ) {
    maybeSingleMock.mockReset();
    maybeSingleMock
      .mockResolvedValueOnce({
        data: { thread_id: "22222222-2222-2222-2222-222222222222", state: handoverState },
        error: null
      })
      .mockResolvedValueOnce({ data: thread, error: null });
  }

  it("marks the handover missed and records who did not show", async () => {
    mockHandoverAndThread("agreed", {
      buyer_id: "44444444-4444-4444-4444-444444444444",
      seller_id: "11111111-1111-1111-1111-111111111111"
    });

    const { reportNoShow } = await import("@/lib/domain/local-threads/threads-service");
    await reportNoShow("33333333-3333-3333-3333-333333333333");

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ state: "missed", no_show_by: "44444444-4444-4444-4444-444444444444" })
    );
  });

  it("checks the rate limit before reporting", async () => {
    mockHandoverAndThread("agreed", {
      buyer_id: "44444444-4444-4444-4444-444444444444",
      seller_id: "11111111-1111-1111-1111-111111111111"
    });

    const { reportNoShow } = await import("@/lib/domain/local-threads/threads-service");
    await reportNoShow("33333333-3333-3333-3333-333333333333");

    expect(checkRateLimit).toHaveBeenCalledWith("local-handover-no-show", 10, 3600);
  });

  it("rejects a caller who is not a participant in the thread", async () => {
    mockHandoverAndThread("agreed", {
      buyer_id: "44444444-4444-4444-4444-444444444444",
      seller_id: "55555555-5555-5555-5555-555555555555"
    });

    const { reportNoShow } = await import("@/lib/domain/local-threads/threads-service");
    await expect(reportNoShow("33333333-3333-3333-3333-333333333333")).rejects.toThrow(
      "Not a participant in this handover."
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects an already-terminal handover", async () => {
    mockHandoverAndThread("missed", {
      buyer_id: "44444444-4444-4444-4444-444444444444",
      seller_id: "11111111-1111-1111-1111-111111111111"
    });

    const { reportNoShow } = await import("@/lib/domain/local-threads/threads-service");
    await expect(reportNoShow("33333333-3333-3333-3333-333333333333")).rejects.toThrow(
      "This handover was already resolved."
    );
    expect(updateMock).not.toHaveBeenCalled();
  });
});
