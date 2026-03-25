import { describe, it, expect } from "vitest";
import { categoryToRole } from "../generator";

describe("categoryToRole", () => {
  it("maps shirt to top", () => {
    expect(categoryToRole("shirt")).toBe("top");
  });
  it("maps Knitwear to top (case-insensitive)", () => {
    expect(categoryToRole("Knitwear")).toBe("top");
  });
  it("maps trousers to bottom", () => {
    expect(categoryToRole("wide-leg trousers")).toBe("bottom");
  });
  it("maps jeans to bottom", () => {
    expect(categoryToRole("jeans")).toBe("bottom");
  });
  it("maps dress to dress", () => {
    expect(categoryToRole("midi dress")).toBe("dress");
  });
  it("maps coat to outerwear", () => {
    expect(categoryToRole("wool coat")).toBe("outerwear");
  });
  it("maps blazer to outerwear", () => {
    expect(categoryToRole("blazer")).toBe("outerwear");
  });
  it("maps trainers to shoes", () => {
    expect(categoryToRole("trainers")).toBe("shoes");
  });
  it("maps loafers to shoes", () => {
    expect(categoryToRole("white loafers")).toBe("shoes");
  });
  it("maps tote bag to bag", () => {
    expect(categoryToRole("tote bag")).toBe("bag");
  });
  it("maps belt to accessory", () => {
    expect(categoryToRole("belt")).toBe("accessory");
  });
  it("maps earrings to jewellery", () => {
    expect(categoryToRole("gold earrings")).toBe("jewellery");
  });
  it("maps unknown category to other", () => {
    expect(categoryToRole("mystery item")).toBe("other");
  });
});
