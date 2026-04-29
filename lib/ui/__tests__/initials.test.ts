import { describe, expect, it } from "vitest";
import { deriveInitials } from "@/lib/ui/initials";

describe("deriveInitials", () => {
  it("uses first letter of each space-separated word from display name", () => {
    expect(deriveInitials("Melarn Murphy", "mel@example.com")).toBe("MM");
  });

  it("caps initials at two characters for long names", () => {
    expect(deriveInitials("Anna Belle Carter", "a@example.com")).toBe("AB");
  });

  it("handles single-word display name", () => {
    expect(deriveInitials("Melarn", "mel@example.com")).toBe("M");
  });

  it("falls back to first two chars of email local part when display name is null", () => {
    expect(deriveInitials(null, "melarn@11point2.io")).toBe("ME");
  });

  it("falls back to email when display name is empty string", () => {
    expect(deriveInitials("   ", "mel@example.com")).toBe("ME");
  });

  it("uppercases initials", () => {
    expect(deriveInitials("anna bell", "a@example.com")).toBe("AB");
  });
});
