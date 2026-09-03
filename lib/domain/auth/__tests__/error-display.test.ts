import { describe, it, expect } from "vitest";
import { shouldShowInlinePasswordError, shouldShowTopBannerError } from "@/lib/domain/auth/error-display";

describe("shouldShowInlinePasswordError", () => {
  it("shows the inline error when the password form raised it", () => {
    expect(shouldShowInlinePasswordError({ error: "Wrong password.", errorSource: "password" })).toBe(true);
  });

  it("does not show the inline error for a magic-link error, even with no mode set", () => {
    expect(shouldShowInlinePasswordError({ error: "Too many attempts.", errorSource: "magic-link" })).toBe(false);
  });

  it("does not show the inline error when there is no error", () => {
    expect(shouldShowInlinePasswordError({ errorSource: "password" })).toBe(false);
  });
});

describe("shouldShowTopBannerError", () => {
  it("shows the top banner for a magic-link error", () => {
    expect(shouldShowTopBannerError({ error: "Too many attempts.", errorSource: "magic-link" })).toBe(true);
  });

  it("shows the top banner for an untagged error (defensive default)", () => {
    expect(shouldShowTopBannerError({ error: "Something went wrong." })).toBe(true);
  });

  it("does not show the top banner for a password-form error", () => {
    expect(shouldShowTopBannerError({ error: "Wrong password.", errorSource: "password" })).toBe(false);
  });

  it("does not show the top banner when there is no error", () => {
    expect(shouldShowTopBannerError({ errorSource: "magic-link" })).toBe(false);
  });
});
