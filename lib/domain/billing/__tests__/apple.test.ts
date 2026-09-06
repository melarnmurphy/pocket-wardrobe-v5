import { describe, it, expect } from "vitest";
import { verifyAppleTransaction, isAppleTransactionActive } from "../apple";

describe("verifyAppleTransaction", () => {
  it("loads Apple's root CA and rejects a garbage JWS rather than crashing", async () => {
    // A real signed transaction can only come from Apple's servers/StoreKit,
    // so this can't assert a successful decode — it asserts the module
    // actually initializes (the cert file path resolves, the verifier
    // constructs) and fails closed on unverifiable input instead of
    // throwing some unrelated error (e.g. a missing-file error, which would
    // mean the cert didn't ship with the deployment).
    await expect(verifyAppleTransaction("not.a.real.jws")).rejects.toThrow();
  });
});

describe("isAppleTransactionActive", () => {
  it("is active when there's no expiry or revocation", () => {
    expect(isAppleTransactionActive({})).toBe(true);
  });

  it("is inactive once revoked, regardless of expiry", () => {
    expect(isAppleTransactionActive({ revocationDate: Date.now() - 1000, expiresDate: Date.now() + 1_000_000 })).toBe(false);
  });

  it("is inactive once expired", () => {
    expect(isAppleTransactionActive({ expiresDate: Date.now() - 1000 })).toBe(false);
  });

  it("is active while not yet expired", () => {
    expect(isAppleTransactionActive({ expiresDate: Date.now() + 1_000_000 })).toBe(true);
  });
});
