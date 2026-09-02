import { describe, it, expect, vi, beforeEach } from "vitest";

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

describe("cancelHandover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null, maybeSingle: maybeSingleMock });
    maybeSingleMock.mockResolvedValue({ data: { thread_id: "22222222-2222-2222-2222-222222222222" }, error: null });
  });

  it("sets the handover state to cancelled and reopens the thread", async () => {
    const { cancelHandover } = await import("@/lib/domain/local-threads/threads-service");
    await cancelHandover("33333333-3333-3333-3333-333333333333");

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ state: "cancelled" }));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ state: "open" }));
  });
});

describe("reportNoShow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null, maybeSingle: maybeSingleMock });
    maybeSingleMock.mockResolvedValue({
      data: { thread_id: "22222222-2222-2222-2222-222222222222", buyer_id: "44444444-4444-4444-4444-444444444444", seller_id: "11111111-1111-1111-1111-111111111111" },
      error: null
    });
  });

  it("marks the handover missed and records who did not show", async () => {
    const { reportNoShow } = await import("@/lib/domain/local-threads/threads-service");
    await reportNoShow("33333333-3333-3333-3333-333333333333");

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ state: "missed", no_show_by: "44444444-4444-4444-4444-444444444444" })
    );
  });
});
