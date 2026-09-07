import { beforeEach, describe, expect, it, vi } from "vitest";

const closeUserAccount = vi.fn();
const getAccountClosureBlockers = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock("@/lib/domain/account/service", () => ({
  closeUserAccount,
  getAccountClosureBlockers
}));
vi.mock("next/navigation", () => ({ redirect }));

describe("closeUserAccountAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an error and never closes the account when the confirmation string is wrong", async () => {
    const { closeUserAccountAction } = await import("@/app/account/close-account-actions");
    const formData = new FormData();
    formData.set("confirmation", "delete");

    const result = await closeUserAccountAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
    expect(closeUserAccount).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns an error and never closes the account when the confirmation is empty", async () => {
    const { closeUserAccountAction } = await import("@/app/account/close-account-actions");

    const result = await closeUserAccountAction({ status: "idle", message: null }, new FormData());

    expect(result.status).toBe("error");
    expect(closeUserAccount).not.toHaveBeenCalled();
  });

  it("accepts the confirmation with different casing and surrounding whitespace, and proceeds to close the account", async () => {
    closeUserAccount.mockResolvedValue(undefined);

    const { closeUserAccountAction } = await import("@/app/account/close-account-actions");
    const formData = new FormData();
    formData.set("confirmation", "CLOSE ");

    await expect(
      closeUserAccountAction({ status: "idle", message: null }, formData)
    ).rejects.toThrow("NEXT_REDIRECT:/");

    expect(closeUserAccount).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/");
  });
});
