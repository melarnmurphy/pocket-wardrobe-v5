import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock = vi.fn(() => ({ eq: eqMock, error: null }));
const updateMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("confirmAge / declineAge / markSafetyBriefSeen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null });
  });

  it("confirmAge sets age_confirmed_at", async () => {
    const { confirmAge } = await import("@/lib/domain/profile/service");
    await confirmAge();
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ age_confirmed_at: expect.any(String) }));
  });

  it("declineAge sets age_declined_at", async () => {
    const { declineAge } = await import("@/lib/domain/profile/service");
    await declineAge();
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ age_declined_at: expect.any(String) }));
  });

  it("markSafetyBriefSeen sets local_safety_brief_seen_at", async () => {
    const { markSafetyBriefSeen } = await import("@/lib/domain/profile/service");
    await markSafetyBriefSeen();
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ local_safety_brief_seen_at: expect.any(String) }));
  });
});
