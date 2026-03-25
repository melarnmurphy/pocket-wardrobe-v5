import { describe, it, expect } from "vitest";
import { RULE_TEMPLATES, STRENGTH_WEIGHTS } from "@/lib/domain/style-rules/templates";

describe("RULE_TEMPLATES", () => {
  it("contains exactly 11 templates", () => {
    expect(RULE_TEMPLATES).toHaveLength(11);
  });

  it("every template has required fields", () => {
    for (const t of RULE_TEMPLATES) {
      expect(t.id, `${t.id} missing id`).toBeTruthy();
      expect(t.category, `${t.id} missing category`).toBeTruthy();
      expect(t.sentence, `${t.id} missing sentence`).toBeTruthy();
      expect(t.rule_type, `${t.id} missing rule_type`).toBeTruthy();
      expect(t.subject_type, `${t.id} missing subject_type`).toBeTruthy();
      expect(t.predicate, `${t.id} missing predicate`).toBeTruthy();
      expect(t.object_type, `${t.id} missing object_type`).toBeTruthy();
      expect(Array.isArray(t.blanks), `${t.id} blanks not array`).toBe(true);
      expect(t.blanks, `${t.id} must have 2 blanks`).toHaveLength(2);
    }
  });

  it("every template id is unique", () => {
    const ids = RULE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("blank[0] and blank[1] resolve to non-empty subject_value and object_value for all templates", () => {
    const sampleValues: Record<string, string> = {
      "a garment": "t-shirt",
      "a base piece": "t-shirt",
      "an outer layer": "jacket",
      "a colour": "navy",
      "another colour": "cream",
      "an occasion": "workwear",
      "a season": "winter",
      "a fit": "relaxed",
    };

    for (const t of RULE_TEMPLATES) {
      const resolve = (blank: typeof t.blanks[0]): string => {
        if (blank.kind === "fixed") return blank.value;
        if (blank.kind === "pick") return blank.options[0];
        return sampleValues[blank.label] ?? blank.suggestions[0] ?? "test-value";
      };

      const subjectValue = resolve(t.blanks[0]);
      const objectValue = resolve(t.blanks[1]);

      expect(subjectValue.length, `${t.id} subject_value is empty`).toBeGreaterThan(0);
      expect(objectValue.length, `${t.id} object_value is empty`).toBeGreaterThan(0);
      expect(subjectValue.length, `${t.id} subject_value too long`).toBeLessThanOrEqual(200);
      expect(objectValue.length, `${t.id} object_value too long`).toBeLessThanOrEqual(200);
    }
  });

  it("season-avoids has a fixed hot_weather blank[1]", () => {
    const t = RULE_TEMPLATES.find((t) => t.id === "season-avoids")!;
    expect(t.blanks[1].kind).toBe("fixed");
    if (t.blanks[1].kind === "fixed") {
      expect(t.blanks[1].value).toBe("hot_weather");
    }
  });

  it("silhouette-balance has both blanks fixed", () => {
    const t = RULE_TEMPLATES.find((t) => t.id === "silhouette-balance")!;
    expect(t.blanks[0].kind).toBe("fixed");
    expect(t.blanks[1].kind).toBe("fixed");
  });

  it("colour-style has blank[1] as pick with monochrome/tonal/contrasting", () => {
    const t = RULE_TEMPLATES.find((t) => t.id === "colour-style")!;
    expect(t.blanks[1].kind).toBe("pick");
    if (t.blanks[1].kind === "pick") {
      expect(t.blanks[1].options).toEqual(["monochrome", "tonal", "contrasting"]);
    }
  });
});

describe("STRENGTH_WEIGHTS", () => {
  it("has all four strength levels", () => {
    expect(STRENGTH_WEIGHTS.always).toBe(1.0);
    expect(STRENGTH_WEIGHTS.often).toBe(0.75);
    expect(STRENGTH_WEIGHTS.sometimes).toBe(0.5);
    expect(STRENGTH_WEIGHTS.rarely).toBe(0.25);
  });
});
