import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Pure-logic mirror of Field's confidence visual cues
// Mirrors the exact logic in app/wardrobe/review/draft-review-list.tsx
// ---------------------------------------------------------------------------

const PROVENANCE_LABELS: Record<string, string> = {
  ai_vision: "AI vision",
  ai_text: "AI text",
  url_parse: "URL",
  filename_text: "Filename",
  rule_based: "Rule-based",
  user_manual: "Manual",
};

function provenanceLabel(p: string | undefined): string {
  return p ? (PROVENANCE_LABELS[p] ?? p) : "Unknown source";
}

function fieldStyles(confidence: number | undefined): {
  borderLeft: string | undefined;
  background: string | undefined;
} {
  const borderColor =
    confidence === undefined || confidence >= 0.8
      ? undefined
      : confidence >= 0.5
        ? "rgba(200,140,40,0.55)"
        : "rgba(208,80,60,0.5)";

  const bgColor =
    confidence === undefined || confidence >= 0.8
      ? undefined
      : confidence >= 0.5
        ? "rgba(200,140,40,0.06)"
        : "rgba(208,80,60,0.05)";

  return {
    borderLeft: borderColor ? `2px solid ${borderColor}` : undefined,
    background: bgColor,
  };
}

function tooltipText(
  confidence: number | undefined,
  provenance: string | undefined
): string | undefined {
  const styles = fieldStyles(confidence);
  if (styles.borderLeft && confidence !== undefined) {
    return `${provenanceLabel(provenance)} · ${Math.round(confidence * 100)}%`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------

describe("Field confidence visual cues", () => {
  it("shows no border or tooltip when confidence is absent", () => {
    const styles = fieldStyles(undefined);
    expect(styles.borderLeft).toBeUndefined();
    expect(styles.background).toBeUndefined();
    expect(tooltipText(undefined, undefined)).toBeUndefined();
  });

  it("shows no border or tooltip when confidence >= 0.8", () => {
    const styles = fieldStyles(0.9);
    expect(styles.borderLeft).toBeUndefined();
    expect(styles.background).toBeUndefined();
    expect(tooltipText(0.9, "ai_vision")).toBeUndefined();
  });

  it("shows amber border and tooltip for confidence 0.5–0.79", () => {
    const styles = fieldStyles(0.65);
    expect(styles.borderLeft).toBe("2px solid rgba(200,140,40,0.55)");
    expect(styles.background).toBe("rgba(200,140,40,0.06)");
    expect(tooltipText(0.65, "ai_text")).toBe("AI text · 65%");
  });

  it("shows red border and tooltip for confidence < 0.5", () => {
    const styles = fieldStyles(0.3);
    expect(styles.borderLeft).toBe("2px solid rgba(208,80,60,0.5)");
    expect(styles.background).toBe("rgba(208,80,60,0.05)");
    expect(tooltipText(0.3, "ai_vision")).toBe("AI vision · 30%");
  });

  it("uses raw provenance key when not in the labels map", () => {
    expect(tooltipText(0.4, "custom_source")).toBe("custom_source · 40%");
  });

  it("uses 'Unknown source' label when provenance is undefined but confidence is low", () => {
    expect(tooltipText(0.3, undefined)).toBe("Unknown source · 30%");
  });

  it("treats confidence exactly 0.8 as high confidence (no border)", () => {
    const styles = fieldStyles(0.8);
    expect(styles.borderLeft).toBeUndefined();
    expect(styles.background).toBeUndefined();
  });

  it("treats confidence exactly 0.5 as amber (not red)", () => {
    const styles = fieldStyles(0.5);
    expect(styles.borderLeft).toBe("2px solid rgba(200,140,40,0.55)");
    expect(styles.background).toBe("rgba(200,140,40,0.06)");
  });
});
