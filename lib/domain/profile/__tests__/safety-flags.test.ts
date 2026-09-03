import { describe, it, expect, vi, beforeEach } from "vitest";

const EXISTING_PROFILE = {
  user_id: "11111111-1111-1111-1111-111111111111",
  local_name: "sam",
  suburb: "Adelaide",
  tops_size: null,
  bottoms_size: null,
  shoes_size: null,
  tops_size_system: "AU",
  bottoms_size_system: "AU",
  shoes_size_system: "AU",
  height_cm: null,
  one_size_either_way: false,
  show_suburb: true,
  show_wear_count: true,
  suburb_lat: null,
  suburb_lng: null,
  radius_km: 30,
  onboarding_completed_at: "2026-01-01T00:00:00Z",
  local_safety_brief_seen_at: null,
  age_confirmed_at: null,
  age_declined_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z"
};

const eqMock = vi.fn(() => ({ eq: eqMock, error: null }));
const updateMock = vi.fn(() => ({ eq: eqMock }));
const maybeSingleMock = vi.fn(async () => ({ data: EXISTING_PROFILE, error: null }));
const selectEqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: selectEqMock }));
const fromMock = vi.fn(() => ({ update: updateMock, select: selectMock }));

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

  it("confirmAge also clears age_declined_at, so a user who declined can reconfirm later", async () => {
    const { confirmAge } = await import("@/lib/domain/profile/service");
    await confirmAge();
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ age_declined_at: null }));
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
