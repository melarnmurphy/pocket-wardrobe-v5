import { describe, it, expect } from "vitest";
import { isDuplicateAccountMessage, looksLikeExistingAccount } from "@/lib/domain/auth/duplicate-signup";

describe("isDuplicateAccountMessage", () => {
  it("matches Supabase's explicit duplicate-account error", () => {
    expect(isDuplicateAccountMessage("User already registered")).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isDuplicateAccountMessage("Password should be at least 6 characters")).toBe(false);
  });
});

describe("looksLikeExistingAccount", () => {
  it("treats an empty identities array as an existing account", () => {
    expect(looksLikeExistingAccount({ identities: [] })).toBe(true);
  });

  it("treats a populated identities array as a new account", () => {
    expect(looksLikeExistingAccount({ identities: [{ id: "abc" }] })).toBe(false);
  });

  it("treats a missing user as not an existing account", () => {
    expect(looksLikeExistingAccount(null)).toBe(false);
  });
});
