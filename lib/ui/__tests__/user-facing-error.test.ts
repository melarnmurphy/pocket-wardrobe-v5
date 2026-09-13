import { describe, expect, it } from "vitest";
import { userFacingError } from "../user-facing-error";

describe("userFacingError", () => {
  it("translates technical storage errors", () => {
    expect(userFacingError(new Error("StorageApiError: bucket not found"), "try again")).toBe(
      "we couldn't save that photo. try a smaller image or try again."
    );
  });

  it("keeps intentional domain copy", () => {
    expect(userFacingError(new Error("that piece is already in your wardrobe"), "try again")).toBe(
      "that piece is already in your wardrobe"
    );
  });

  it("falls back for opaque diagnostics", () => {
    expect(userFacingError(new Error("PGRST123 {internal details}"), "please try again later")).toBe(
      "please try again later"
    );
  });
});
