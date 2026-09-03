import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const select = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("requestDataExport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records a new export request for the user", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "req1", requested_at: "2026-09-02T00:00:00.000Z" },
      error: null
    });
    const selectAfterInsert = vi.fn(() => ({ single }));
    insert.mockReturnValue({ select: selectAfterInsert });
    from.mockReturnValue({ insert });

    const { requestDataExport } = await import("@/lib/domain/account/service");
    const result = await requestDataExport();

    expect(result).toEqual({ id: "req1", requestedAt: "2026-09-02T00:00:00.000Z" });
    expect(insert).toHaveBeenCalledWith({ user_id: "11111111-1111-1111-1111-111111111111" });
  });
});

describe("getLatestDataExportRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the user has never requested an export", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    select.mockReturnValue({ eq });
    from.mockReturnValue({ select });

    const { getLatestDataExportRequest } = await import("@/lib/domain/account/service");
    expect(await getLatestDataExportRequest()).toBeNull();
  });

  it("returns the most recent request, ready or not", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "req2",
          requested_at: "2026-09-02T00:00:00.000Z",
          ready_at: "2026-09-02T01:00:00.000Z",
          status: "ready"
        }
      ],
      error: null
    });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    select.mockReturnValue({ eq });
    from.mockReturnValue({ select });

    const { getLatestDataExportRequest } = await import("@/lib/domain/account/service");
    expect(await getLatestDataExportRequest()).toEqual({
      id: "req2",
      requestedAt: "2026-09-02T00:00:00.000Z",
      readyAt: "2026-09-02T01:00:00.000Z",
      status: "ready"
    });
  });
});
