import { describe, it, expect, vi, beforeEach } from "vitest";

let maybeSingleMock: any;
let eqMock: any;
let selectMock: any;
let updateMock: any;
let insertMock: any;
let fromMock: any;
let updateSelectMock: any;

maybeSingleMock = vi.fn();
eqMock = vi.fn(() => ({ eq: eqMock, maybeSingle: maybeSingleMock, select: updateSelectMock }));
updateSelectMock = vi.fn(() => Promise.resolve({ data: [{ id: "44444444-4444-4444-4444-444444444444" }], error: null }));
updateMock = vi.fn(() => ({ eq: eqMock }));
selectMock = vi.fn(() => ({ eq: eqMock, maybeSingle: maybeSingleMock }));
insertMock = vi.fn(() => ({ error: null }));
fromMock = vi.fn((table: string) => {
  if (table === "messages") {
    return { update: updateMock, select: selectMock, insert: insertMock };
  }
  return { select: selectMock, update: updateMock, insert: insertMock };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => {}) }));

describe("respondToOffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, maybeSingle: maybeSingleMock, select: updateSelectMock });
    updateSelectMock.mockResolvedValue({ data: [{ id: "44444444-4444-4444-4444-444444444444" }], error: null });
    maybeSingleMock.mockResolvedValue({
      data: { thread_id: "22222222-2222-2222-2222-222222222222", sender_id: "33333333-3333-3333-3333-333333333333" },
      error: null
    });
  });

  it("sets offer_status to declined", async () => {
    const { respondToOffer } = await import("@/lib/domain/local-threads/threads-service");
    await respondToOffer("44444444-4444-4444-4444-444444444444");

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ offer_status: "declined" }));
  });

  it("throws instead of silently succeeding when the update matches zero rows", async () => {
    updateSelectMock.mockResolvedValue({ data: [], error: null });

    const { respondToOffer } = await import("@/lib/domain/local-threads/threads-service");
    await expect(respondToOffer("44444444-4444-4444-4444-444444444444")).rejects.toThrow(
      "Unable to update that offer."
    );
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("withdrawOffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, maybeSingle: maybeSingleMock, select: updateSelectMock });
    updateSelectMock.mockResolvedValue({ data: [{ id: "44444444-4444-4444-4444-444444444444" }], error: null });
    maybeSingleMock.mockResolvedValue({
      data: { thread_id: "22222222-2222-2222-2222-222222222222", sender_id: "11111111-1111-1111-1111-111111111111" },
      error: null
    });
  });

  it("sets offer_status to withdrawn", async () => {
    const { withdrawOffer } = await import("@/lib/domain/local-threads/threads-service");
    await withdrawOffer("44444444-4444-4444-4444-444444444444");

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ offer_status: "withdrawn" }));
  });

  it("throws instead of silently succeeding when the update matches zero rows", async () => {
    updateSelectMock.mockResolvedValue({ data: [], error: null });

    const { withdrawOffer } = await import("@/lib/domain/local-threads/threads-service");
    await expect(withdrawOffer("44444444-4444-4444-4444-444444444444")).rejects.toThrow(
      "Unable to update that offer."
    );
    expect(insertMock).not.toHaveBeenCalled();
  });
});
