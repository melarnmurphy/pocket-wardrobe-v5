import { describe, it, expect } from "vitest";
import { mapMagicLinkError, mapSignInPasswordError } from "@/lib/domain/auth/sign-in-errors";

describe("mapSignInPasswordError", () => {
  it("rewrites Supabase's generic credentials error into inline copy", () => {
    expect(mapSignInPasswordError("Invalid login credentials")).toBe(
      "Wrong email or password. Try again, or reset it below."
    );
  });

  it("passes through any other error message unchanged", () => {
    expect(mapSignInPasswordError("Email not confirmed")).toBe("Email not confirmed");
  });
});

describe("mapMagicLinkError", () => {
  it("rewrites Supabase's rejected-address error into copy that belongs on the sign-in page", () => {
    expect(mapMagicLinkError('Email address "test@example.com" is invalid')).toBe(
      "That email address isn't accepted. Check the spelling and try again."
    );
  });

  it("passes through any other error message unchanged", () => {
    expect(mapMagicLinkError("Error sending magic link email")).toBe("Error sending magic link email");
  });
});
