import { describe, it, expect } from "vitest";
import { mapSignInPasswordError } from "@/lib/domain/auth/sign-in-errors";

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
