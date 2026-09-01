import { describe, it, expect } from "vitest";
import { computeLabelEvent } from "@/lib/domain/training/label-events";

describe("computeLabelEvent", () => {
  const model = {
    category: "dress",
    colour: "black",
    material: "",
    style: "",
    brand: "",
    title: "Black dress",
  };

  it("returns confirmed with no corrected fields when values match", () => {
    const result = computeLabelEvent(model, { ...model });
    expect(result.eventType).toBe("confirmed");
    expect(result.correctedFields).toEqual([]);
  });

  it("flags a single changed field as corrected", () => {
    const result = computeLabelEvent(model, { ...model, category: "shirt" });
    expect(result.eventType).toBe("corrected");
    expect(result.correctedFields).toEqual(["category"]);
  });

  it("collects all changed fields", () => {
    const result = computeLabelEvent(model, {
      ...model,
      category: "shirt",
      colour: "white",
    });
    expect(result.eventType).toBe("corrected");
    expect(result.correctedFields.sort()).toEqual(["category", "colour"]);
  });

  it("ignores case and surrounding whitespace", () => {
    const result = computeLabelEvent(model, { ...model, category: "  Dress " });
    expect(result.eventType).toBe("confirmed");
    expect(result.correctedFields).toEqual([]);
  });

  it("treats empty model value vs set final value as a correction", () => {
    const result = computeLabelEvent(model, { ...model, material: "cotton" });
    expect(result.correctedFields).toEqual(["material"]);
  });
});
