# Style Rule Template UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the raw knowledge-graph form on `/style-rules` with a plain-language template gallery where users fill in blanks and choose a strength, with zero exposure to graph schema concepts.

**Architecture:** `lib/domain/style-rules/templates.ts` defines all 11 templates as typed data objects mapping plain-language sentences to knowledge graph triples. `StyleRuleTemplateForm` renders the gallery and composes a `FormData` payload identical to what the existing `createStyleRuleFormAction` already accepts — no server-side changes needed. `StyleRuleBlankInput` handles the free-text-with-suggestions UX for individual blanks.

**Tech Stack:** Next.js App Router, TypeScript, React `useActionState`, Vitest

---

## File Map

| File | Change |
|---|---|
| `lib/domain/style-rules/templates.ts` | CREATE — template definitions, `BlankDef`, `RuleTemplate`, `STRENGTH_WEIGHTS` types |
| `lib/domain/style-rules/__tests__/templates.test.ts` | CREATE — unit tests for all 11 templates |
| `components/style-rule-blank-input.tsx` | CREATE — controlled text input with suggestion chips |
| `components/style-rule-template-form.tsx` | CREATE — template gallery form replacing `StyleRuleForm` |
| `components/style-rule-form.tsx` | DELETE — replaced entirely |
| `app/style-rules/page.tsx` | MODIFY — swap `StyleRuleForm` for `StyleRuleTemplateForm` |

---

## Task 1: Template definitions

**Files:**
- Create: `lib/domain/style-rules/templates.ts`
- Create: `lib/domain/style-rules/__tests__/templates.test.ts`

### Background

`templates.ts` is a pure TypeScript module — no React, no Supabase. It exports the 11 templates and the `STRENGTH_WEIGHTS` constant. The form component reads this file at runtime to build the gallery and compose `FormData` on submit.

Each template has `blanks: BlankDef[]` where `blank[0]` always supplies `subject_value` and `blank[1]` always supplies `object_value`, via:
- `kind: "text"` — free-text input, user types or picks a suggestion chip
- `kind: "pick"` — single-choice pill picker, user must select one option (no free text)
- `kind: "fixed"` — never rendered, value baked in at definition time

`season-avoids` has a hidden `blank[1]: { kind: "fixed", value: "hot_weather" }` carrier even though its sentence only shows one `___`. `silhouette-balance` has both blanks fixed — only the strength picker is shown.

Suggestion arrays for `kind: "text"` blanks:
- Garment categories: define a `GARMENT_CATEGORY_SUGGESTIONS` constant inline in `templates.ts`
- Colours: `[...colourFamilies]` from `lib/domain/style-rules/knowledge/colours.ts`
- Occasions: `[...occasionProfiles]` from `lib/domain/style-rules/knowledge/occasions.ts`
- Seasons: `["summer", "winter", "spring", "autumn"]`
- Fits: `["relaxed", "fitted", "oversized", "tailored", "slim", "wide-leg", "straight"]`

- [ ] **Step 1: Write failing tests**

Create `lib/domain/style-rules/__tests__/templates.test.ts`:

```typescript
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
      "a colour": "navy",
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
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
cd /Users/melarnmurphy/play-projects/fashionapp5
npm test -- --run lib/domain/style-rules/__tests__/templates.test.ts
```

Expected: fails with "Cannot find module" or similar.

- [ ] **Step 3: Implement `lib/domain/style-rules/templates.ts`**

```typescript
import { colourFamilies } from "@/lib/domain/style-rules/knowledge/colours";
import { occasionProfiles } from "@/lib/domain/style-rules/knowledge/occasions";

export type TemplateCategory =
  | "layering"
  | "colour"
  | "occasions"
  | "season"
  | "silhouette";

export type BlankDef =
  | { kind: "text";  label: string; suggestions: string[] }
  | { kind: "pick";  label: string; options: string[] }
  | { kind: "fixed"; value: string };

export type RuleTemplate = {
  id: string;
  category: TemplateCategory;
  sentence: string;
  blanks: [BlankDef, BlankDef];
  rule_type: string;
  subject_type: string;
  predicate: string;
  object_type: string;
};

export const STRENGTH_WEIGHTS = {
  always:    1.0,
  often:     0.75,
  sometimes: 0.5,
  rarely:    0.25,
} as const;

export type Strength = keyof typeof STRENGTH_WEIGHTS;

const GARMENT_CATEGORY_SUGGESTIONS = [
  "t-shirt", "shirt", "blouse", "tank", "turtleneck", "knitwear", "vest",
  "bodysuit", "base-layer", "dress", "blazer", "jacket", "coat",
  "denim jacket", "cardigan", "puffer", "waistcoat", "jeans", "trousers",
  "shorts", "skirt", "leggings", "sneakers", "boots", "loafers", "heels",
  "sandals", "trainers",
];

const garment = (label = "a garment"): BlankDef =>
  ({ kind: "text", label, suggestions: GARMENT_CATEGORY_SUGGESTIONS });

const colour = (label = "a colour"): BlankDef =>
  ({ kind: "text", label, suggestions: [...colourFamilies] });

const occasion = (label = "an occasion"): BlankDef =>
  ({ kind: "text", label, suggestions: [...occasionProfiles] });

const season = (label = "a season"): BlankDef =>
  ({ kind: "text", label, suggestions: ["summer", "winter", "spring", "autumn"] });

const fit = (label = "a fit"): BlankDef =>
  ({ kind: "text", label, suggestions: ["relaxed", "fitted", "oversized", "tailored", "slim", "wide-leg", "straight"] });

export const RULE_TEMPLATES: RuleTemplate[] = [
  // LAYERING
  {
    id: "layering-likes",
    category: "layering",
    sentence: "I like layering ___ under ___",
    blanks: [garment("a base piece"), garment("an outer layer")],
    rule_type: "layering",
    subject_type: "category",
    predicate: "layerable_with",
    object_type: "category",
  },
  {
    id: "layering-avoids",
    category: "layering",
    sentence: "I don't layer ___ under ___",
    blanks: [garment("a base piece"), garment("an outer layer")],
    rule_type: "layering",
    subject_type: "category",
    predicate: "avoid_layering_with",
    object_type: "category",
  },

  // COLOUR
  {
    id: "colour-likes",
    category: "colour",
    sentence: "I like pairing ___ with ___",
    blanks: [colour("a colour"), colour("another colour")],
    rule_type: "colour_pairing",
    subject_type: "colour",
    predicate: "pairs_with",
    object_type: "colour",
  },
  {
    id: "colour-avoids",
    category: "colour",
    sentence: "I avoid wearing ___ with ___",
    blanks: [colour("a colour"), colour("another colour")],
    rule_type: "colour_pairing",
    subject_type: "colour",
    predicate: "avoid_with",
    object_type: "colour",
  },
  {
    id: "colour-style",
    category: "colour",
    sentence: "I prefer ___ outfits",
    blanks: [
      { kind: "fixed", value: "preference" },
      { kind: "pick", label: "colour style", options: ["monochrome", "tonal", "contrasting"] },
    ],
    rule_type: "colour_preference",
    subject_type: "preference",
    predicate: "prefers",
    object_type: "colour_style",
  },

  // OCCASIONS
  {
    id: "occasion-wears",
    category: "occasions",
    sentence: "I wear ___ for ___ occasions",
    blanks: [garment("a garment"), occasion("an occasion")],
    rule_type: "occasion_fit",
    subject_type: "category",
    predicate: "appropriate_for",
    object_type: "occasion",
  },
  {
    id: "occasion-avoids",
    category: "occasions",
    sentence: "I don't wear ___ to ___",
    blanks: [garment("a garment"), occasion("an occasion")],
    rule_type: "occasion_fit",
    subject_type: "category",
    predicate: "avoid_for",
    object_type: "occasion",
  },

  // SEASON
  {
    id: "season-wears",
    category: "season",
    sentence: "I wear ___ in ___",
    blanks: [garment("a garment"), season("a season")],
    rule_type: "seasonality",
    subject_type: "category",
    predicate: "works_in_season",
    object_type: "season",
  },
  {
    id: "season-avoids",
    category: "season",
    sentence: "I avoid ___ in hot weather",
    blanks: [
      garment("a garment"),
      { kind: "fixed", value: "hot_weather" },
    ],
    rule_type: "seasonality",
    subject_type: "category",
    predicate: "avoid_in_season",
    object_type: "season",
  },

  // SILHOUETTE
  {
    id: "silhouette-balance",
    category: "silhouette",
    sentence: "I balance oversized tops with fitted bottoms",
    blanks: [
      { kind: "fixed", value: "oversized" },
      { kind: "fixed", value: "fitted" },
    ],
    rule_type: "silhouette",
    subject_type: "fit",
    predicate: "balances_with",
    object_type: "fit",
  },
  {
    id: "silhouette-prefers",
    category: "silhouette",
    sentence: "I prefer ___ fits",
    blanks: [
      fit("a fit"),
      { kind: "fixed", value: "preference" },
    ],
    rule_type: "silhouette",
    subject_type: "fit",
    predicate: "prefers",
    object_type: "fit",
  },
];
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- --run lib/domain/style-rules/__tests__/templates.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/style-rules/templates.ts lib/domain/style-rules/__tests__/templates.test.ts
git commit -m "feat: add style rule template definitions with BlankDef types"
```

---

## Task 2: `StyleRuleBlankInput` component

**Files:**
- Create: `components/style-rule-blank-input.tsx`

### Background

This component handles rendering a single blank in the template sentence. It is only rendered for `kind: "text"` blanks. `kind: "pick"` is handled inline in `StyleRuleTemplateForm` (a simple set of pill buttons). `kind: "fixed"` is never rendered.

Props:
```typescript
type Props = {
  blank: Extract<BlankDef, { kind: "text" }>;
  value: string;
  onChange: (value: string) => void;
};
```

Renders:
1. A text `<input>` (inline styled)
2. A row of suggestion chips below it — clicking a chip sets the value

- [ ] **Step 1: Create the component**

Create `components/style-rule-blank-input.tsx`:

```typescript
"use client";

import type { BlankDef } from "@/lib/domain/style-rules/templates";

type TextBlank = Extract<BlankDef, { kind: "text" }>;

export function StyleRuleBlankInput({
  blank,
  value,
  onChange,
}: {
  blank: TextBlank;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex flex-col gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={blank.label}
        className="rounded-2xl border border-[var(--line)] bg-white px-3 py-1.5 text-sm outline-none min-w-[120px]"
      />
      {blank.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-w-xs">
          {blank.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                value === s
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run typecheck
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/style-rule-blank-input.tsx
git commit -m "feat: add StyleRuleBlankInput component"
```

---

## Task 3: `StyleRuleTemplateForm` component

**Files:**
- Create: `components/style-rule-template-form.tsx`

### Background

This is the main form component that replaces `StyleRuleForm`. It renders:

1. **Template gallery** — 11 templates grouped by category, displayed as cards. One template is active at a time. Clicking a template card activates it (and deactivates the current one). The gallery section is always visible.

2. **Active template detail** — shown below the gallery when a template is selected. Contains:
   - The sentence with blank inputs rendered inline for `kind: "text"` and `kind: "pick"` blanks
   - The strength picker: Always / Often / Sometimes / Rarely pill buttons
   - Hidden inputs for all structural fields (rule_type, subject_type, predicate, object_type, active="on")
   - A hidden input for explanation (auto-generated from sentence + blank values + strength label)

3. **Submit button** — disabled until a template is active and all `kind: "text"` blanks have a non-empty value.

State:
```typescript
const [activeId, setActiveId] = useState<string | null>(null);
const [blankValues, setBlankValues] = useState<Record<string, [string, string]>>({});
const [strength, setStrength] = useState<Strength>("often");
```

`blankValues` is keyed by `template.id` and stores `[blank0Value, blank1Value]` — so switching between templates preserves the user's inputs.

**Resolving FormData values from a blank:**
```typescript
function resolveBlankValue(blank: BlankDef, userValue: string): string {
  if (blank.kind === "fixed") return blank.value;
  if (blank.kind === "pick") return userValue; // set by pill selection
  return userValue; // free text
}
```

**Auto-generating explanation:**
Build a readable sentence by substituting resolved values into the template sentence, replacing `___` occurrences in order with the resolved values for rendered (non-fixed) blanks. Append ` — ${strength}`.

Example: template `"I like layering ___ under ___"` with values `["t-shirt", "jacket"]` and strength `"always"` → `"I like layering t-shirt under jacket — always"`.

For `silhouette-balance` (no rendered blanks): `"I balance oversized tops with fitted bottoms — often"`.

**Native form submission** — use a `<form action={formAction}>` with hidden `<input>` elements for the structural fields. `useActionState` resets the form on success (same pattern as the existing `StyleRuleForm`).

- [ ] **Step 1: Implement the component**

Create `components/style-rule-template-form.tsx`:

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  RULE_TEMPLATES,
  STRENGTH_WEIGHTS,
  type RuleTemplate,
  type BlankDef,
  type Strength,
  type TemplateCategory,
} from "@/lib/domain/style-rules/templates";
import { StyleRuleBlankInput } from "@/components/style-rule-blank-input";
import { FormFeedback } from "@/components/form-feedback";
import { showAppToast } from "@/lib/ui/app-toast";
import { formActionState, type FormActionState } from "@/lib/ui/form-action-state";

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  layering: "Layering",
  colour: "Colour",
  occasions: "Occasions",
  season: "Season & Weather",
  silhouette: "Silhouette",
};

const CATEGORIES: TemplateCategory[] = ["layering", "colour", "occasions", "season", "silhouette"];
const STRENGTHS: Strength[] = ["always", "often", "sometimes", "rarely"];

function resolveBlankValue(blank: BlankDef, userValue: string): string {
  if (blank.kind === "fixed") return blank.value;
  return userValue;
}

function buildExplanation(template: RuleTemplate, values: [string, string], strength: Strength): string {
  const rendered: string[] = [];
  for (const blank of template.blanks) {
    if (blank.kind !== "fixed") {
      rendered.push(blank.kind === "pick"
        ? values[template.blanks.indexOf(blank) as 0 | 1]
        : values[template.blanks.indexOf(blank) as 0 | 1]);
    }
  }
  let sentence = template.sentence;
  for (const v of rendered) {
    sentence = sentence.replace("___", v);
  }
  return `${sentence} — ${strength}`;
}

export function StyleRuleTemplateForm({
  action,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(action, formActionState);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [blankValues, setBlankValues] = useState<Record<string, [string, string]>>({});
  const [strength, setStrength] = useState<Strength>("often");

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setActiveId(null);
      setBlankValues({});
      setStrength("often");
      showAppToast({ message: state.message || "Style rule saved", tone: "success" });
    }
  }, [state.message, state.status]);

  const activeTemplate = RULE_TEMPLATES.find((t) => t.id === activeId) ?? null;
  const activeValues: [string, string] = activeId
    ? (blankValues[activeId] ?? ["", ""])
    : ["", ""];

  function setBlankValue(templateId: string, index: 0 | 1, value: string) {
    setBlankValues((prev) => {
      const current = prev[templateId] ?? ["", ""];
      const updated: [string, string] = [...current] as [string, string];
      updated[index] = value;
      return { ...prev, [templateId]: updated };
    });
  }

  function isSubmittable(): boolean {
    if (!activeTemplate) return false;
    for (let i = 0; i < 2; i++) {
      const blank = activeTemplate.blanks[i];
      if (blank.kind === "text" && !activeValues[i].trim()) return false;
      if (blank.kind === "pick" && !activeValues[i]) return false;
    }
    return true;
  }

  const subjectValue = activeTemplate
    ? resolveBlankValue(activeTemplate.blanks[0], activeValues[0])
    : "";
  const objectValue = activeTemplate
    ? resolveBlankValue(activeTemplate.blanks[1], activeValues[1])
    : "";
  const explanation = activeTemplate
    ? buildExplanation(activeTemplate, activeValues, strength)
    : "";

  return (
    <div className="rounded-[1.75rem] border border-[var(--line)] bg-white/65 p-6 md:p-7">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Add a Personal Rule</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
          Pick a statement that matches how you dress and fill in the blanks.
        </p>
      </div>

      {/* Template gallery */}
      <div className="space-y-5">
        {CATEGORIES.map((cat) => (
          <section key={cat}>
            <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              {CATEGORY_LABELS[cat]}
            </p>
            <div className="flex flex-col gap-2">
              {RULE_TEMPLATES.filter((t) => t.category === cat).map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setActiveId(activeId === template.id ? null : template.id)}
                  className={`rounded-[1.25rem] border px-4 py-3 text-left text-sm transition-all ${
                    activeId === template.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/5 font-medium text-[var(--accent)]"
                      : "border-[var(--line)] bg-white/70 text-[#1a1a1a] hover:border-[var(--accent)]/50"
                  }`}
                >
                  {template.sentence.replace(/___/g, "·····")}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Active template detail */}
      {activeTemplate && (
        <form ref={formRef} action={formAction} className="mt-6 rounded-[1.35rem] border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-5">
          {/* Hidden structural fields */}
          <input type="hidden" name="rule_type" value={activeTemplate.rule_type} />
          <input type="hidden" name="subject_type" value={activeTemplate.subject_type} />
          <input type="hidden" name="subject_value" value={subjectValue} />
          <input type="hidden" name="predicate" value={activeTemplate.predicate} />
          <input type="hidden" name="object_type" value={activeTemplate.object_type} />
          <input type="hidden" name="object_value" value={objectValue} />
          <input type="hidden" name="weight" value={STRENGTH_WEIGHTS[strength]} />
          <input type="hidden" name="explanation" value={explanation} />
          <input type="hidden" name="active" value="on" />

          {/* Sentence with blanks */}
          <div className="mb-5">
            <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Fill in the blanks</p>
            <div className="flex flex-wrap items-start gap-2 text-sm font-medium text-[#1a1a1a]">
              {renderSentenceWithBlanks(activeTemplate, activeValues, activeId!, setBlankValue)}
            </div>
          </div>

          {/* Strength picker */}
          <div className="mb-5">
            <p className="mb-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">How often?</p>
            <div className="flex gap-2">
              {STRENGTHS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStrength(s)}
                  className={`flex-1 rounded-[1rem] border py-2 text-sm font-medium capitalize transition-colors ${
                    strength === s
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <SubmitButton disabled={!isSubmittable()} />
          <FormFeedback state={state} />
        </form>
      )}
    </div>
  );
}

function renderSentenceWithBlanks(
  template: RuleTemplate,
  values: [string, string],
  templateId: string,
  setBlankValue: (id: string, index: 0 | 1, value: string) => void
): React.ReactNode[] {
  const parts = template.sentence.split("___");
  const renderedBlanks = template.blanks
    .map((blank, i) => ({ blank, index: i as 0 | 1 }))
    .filter(({ blank }) => blank.kind !== "fixed");

  const nodes: React.ReactNode[] = [];
  parts.forEach((part, partIndex) => {
    if (part) nodes.push(<span key={`part-${partIndex}`}>{part}</span>);
    if (partIndex < renderedBlanks.length) {
      const { blank, index } = renderedBlanks[partIndex];
      if (blank.kind === "text") {
        nodes.push(
          <StyleRuleBlankInput
            key={`blank-${index}`}
            blank={blank}
            value={values[index]}
            onChange={(v) => setBlankValue(templateId, index, v)}
          />
        );
      } else if (blank.kind === "pick") {
        nodes.push(
          <div key={`pick-${index}`} className="flex gap-1.5">
            {blank.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setBlankValue(templateId, index, opt)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  values[index] === opt
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--accent)]/50"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        );
      }
    }
  });
  return nodes;
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="mt-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-foreground)] shadow-[0_12px_25px_rgba(166,99,60,0.18)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(166,99,60,0.24)] active:translate-y-0 active:scale-[0.98] disabled:transform-none disabled:opacity-60 disabled:shadow-none"
    >
      {pending ? "Saving..." : "Save Rule"}
    </button>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run typecheck
```

Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add components/style-rule-template-form.tsx
git commit -m "feat: add StyleRuleTemplateForm component with template gallery"
```

---

## Task 4: Wire up page and remove old form

**Files:**
- Modify: `app/style-rules/page.tsx`
- Delete: `components/style-rule-form.tsx`

### Background

`app/style-rules/page.tsx` currently imports `StyleRuleForm` and renders it with `createStyleRuleFormAction`. Replace the import and component usage. No action or section changes needed.

The `StyleRuleForm` component in `components/style-rule-form.tsx` is only imported by `app/style-rules/page.tsx` — safe to delete once the page is updated.

- [ ] **Step 1: Update `app/style-rules/page.tsx`**

Replace the `StyleRuleForm` import and its usage:

```diff
-import { StyleRuleForm } from "@/components/style-rule-form";
+import { StyleRuleTemplateForm } from "@/components/style-rule-template-form";
```

And in the JSX:
```diff
-<StyleRuleForm action={createStyleRuleFormAction} />
+<StyleRuleTemplateForm action={createStyleRuleFormAction} />
```

- [ ] **Step 2: Delete `components/style-rule-form.tsx`**

```bash
rm /Users/melarnmurphy/play-projects/fashionapp5/components/style-rule-form.tsx
```

- [ ] **Step 3: Run full test suite and typecheck**

```bash
npm test -- --run
npm run typecheck
```

Expected: all tests pass, no type errors. If typecheck surfaces a missing import of `StyleRuleForm` somewhere unexpected, check with `grep -r "style-rule-form" --include="*.ts" --include="*.tsx" .` and fix any remaining references.

- [ ] **Step 4: Commit**

```bash
git add app/style-rules/page.tsx
git rm components/style-rule-form.tsx
git commit -m "feat: replace raw style rule form with plain-language template UI"
```

---

## Verification

After all tasks are complete, manually verify:

1. Navigate to `/style-rules`
2. The template gallery is visible with 5 category groups and 11 templates
3. Click "I like layering ___ under ___" — it activates and shows blank inputs
4. Type "t-shirt" in the first blank (or click the chip) and "jacket" in the second
5. Select "Always"
6. Click "Save Rule" — the rule appears in the User Rules section below
7. Verify the rule card shows: `t-shirt layerable_with jacket` with weight 1.0 and explanation "I like layering t-shirt under jacket — always"
8. Click "I prefer ___ outfits" — verify the pill picker shows monochrome / tonal / contrasting
9. Click "I balance oversized tops with fitted bottoms" — verify only the strength picker is shown (no blanks)
