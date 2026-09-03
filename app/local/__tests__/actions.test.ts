import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("respondToOfferAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns success and revalidates the thread on decline", async () => {
    vi.doMock("@/lib/domain/local-threads/threads-service", async () => {
      const actual = await vi.importActual("@/lib/domain/local-threads/threads-service");
      return { ...actual, respondToOffer: vi.fn(async () => {}) };
    });
    const { respondToOfferAction } = await import("@/app/local/actions");

    const result = await respondToOfferAction("11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222");

    expect(result.status).toBe("success");
    vi.doUnmock("@/lib/domain/local-threads/threads-service");
  });
});

describe("withdrawOfferAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns success and revalidates the thread", async () => {
    vi.doMock("@/lib/domain/local-threads/threads-service", async () => {
      const actual = await vi.importActual("@/lib/domain/local-threads/threads-service");
      return { ...actual, withdrawOffer: vi.fn(async () => {}) };
    });
    const { withdrawOfferAction } = await import("@/app/local/actions");

    const result = await withdrawOfferAction("11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222");

    expect(result.status).toBe("success");
    vi.doUnmock("@/lib/domain/local-threads/threads-service");
  });
});

describe("cancelHandoverAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns success and revalidates the thread", async () => {
    vi.doMock("@/lib/domain/local-threads/threads-service", async () => {
      const actual = await vi.importActual("@/lib/domain/local-threads/threads-service");
      return { ...actual, cancelHandover: vi.fn(async () => {}) };
    });
    const { cancelHandoverAction } = await import("@/app/local/actions");

    const result = await cancelHandoverAction("11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222");

    expect(result.status).toBe("success");
    vi.doUnmock("@/lib/domain/local-threads/threads-service");
  });
});

describe("reportNoShowAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns success and revalidates the thread", async () => {
    vi.doMock("@/lib/domain/local-threads/threads-service", async () => {
      const actual = await vi.importActual("@/lib/domain/local-threads/threads-service");
      return { ...actual, reportNoShow: vi.fn(async () => {}) };
    });
    const { reportNoShowAction } = await import("@/app/local/actions");

    const result = await reportNoShowAction("11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222");

    expect(result.status).toBe("success");
    vi.doUnmock("@/lib/domain/local-threads/threads-service");
  });
});

describe("cancelListingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("withdraws the listing and closes the given thread when one is passed", async () => {
    vi.doMock("@/lib/domain/local-threads/threads-service", async () => {
      const actual = await vi.importActual("@/lib/domain/local-threads/threads-service");
      return {
        ...actual,
        withdrawLocalListing: vi.fn(async () => {}),
        closeThreadForCancelledListing: vi.fn(async () => {})
      };
    });
    const { cancelListingAction } = await import("@/app/local/actions");
    const { closeThreadForCancelledListing } = await import("@/lib/domain/local-threads/threads-service");

    const result = await cancelListingAction("33333333-3333-3333-3333-333333333333", "44444444-4444-4444-4444-444444444444");

    expect(result.status).toBe("success");
    expect(closeThreadForCancelledListing).toHaveBeenCalledWith("44444444-4444-4444-4444-444444444444");
    vi.doUnmock("@/lib/domain/local-threads/threads-service");
  });

  it("withdraws the listing without closing a thread when none is passed", async () => {
    vi.doMock("@/lib/domain/local-threads/threads-service", async () => {
      const actual = await vi.importActual("@/lib/domain/local-threads/threads-service");
      return {
        ...actual,
        withdrawLocalListing: vi.fn(async () => {}),
        closeThreadForCancelledListing: vi.fn(async () => {})
      };
    });
    const { cancelListingAction } = await import("@/app/local/actions");
    const { closeThreadForCancelledListing } = await import("@/lib/domain/local-threads/threads-service");

    const result = await cancelListingAction("33333333-3333-3333-3333-333333333333");

    expect(result.status).toBe("success");
    expect(closeThreadForCancelledListing).not.toHaveBeenCalled();
    vi.doUnmock("@/lib/domain/local-threads/threads-service");
  });
});

describe("listBlockedUsersAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns the list of blocked users from the service", async () => {
    const rows = [{ userId: "u1", localName: "Jo", blockedAt: "2026-01-01T00:00:00Z" }];
    vi.doMock("@/lib/domain/local-threads/threads-service", async () => {
      const actual = await vi.importActual("@/lib/domain/local-threads/threads-service");
      return { ...actual, listBlockedUsers: vi.fn(async () => rows) };
    });
    const { listBlockedUsersAction } = await import("@/app/local/actions");

    const result = await listBlockedUsersAction();

    expect(result).toEqual(rows);
    vi.doUnmock("@/lib/domain/local-threads/threads-service");
  });
});

describe("age and safety flag actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("markSafetyBriefSeenAction calls the profile service function", async () => {
    vi.doMock("@/lib/domain/profile/service", async () => {
      const actual = await vi.importActual("@/lib/domain/profile/service");
      return { ...actual, markSafetyBriefSeen: vi.fn(async () => {}) };
    });
    const { markSafetyBriefSeenAction } = await import("@/app/local/actions");
    const { markSafetyBriefSeen } = await import("@/lib/domain/profile/service");

    await markSafetyBriefSeenAction();

    expect(markSafetyBriefSeen).toHaveBeenCalled();
    vi.doUnmock("@/lib/domain/profile/service");
  });

  it("confirmAgeAction calls the profile service function", async () => {
    vi.doMock("@/lib/domain/profile/service", async () => {
      const actual = await vi.importActual("@/lib/domain/profile/service");
      return { ...actual, confirmAge: vi.fn(async () => {}) };
    });
    const { confirmAgeAction } = await import("@/app/local/actions");
    const { confirmAge } = await import("@/lib/domain/profile/service");

    await confirmAgeAction();

    expect(confirmAge).toHaveBeenCalled();
    vi.doUnmock("@/lib/domain/profile/service");
  });

  it("declineAgeAction calls the profile service function", async () => {
    vi.doMock("@/lib/domain/profile/service", async () => {
      const actual = await vi.importActual("@/lib/domain/profile/service");
      return { ...actual, declineAge: vi.fn(async () => {}) };
    });
    const { declineAgeAction } = await import("@/app/local/actions");
    const { declineAge } = await import("@/lib/domain/profile/service");

    await declineAgeAction();

    expect(declineAge).toHaveBeenCalled();
    vi.doUnmock("@/lib/domain/profile/service");
  });
});
