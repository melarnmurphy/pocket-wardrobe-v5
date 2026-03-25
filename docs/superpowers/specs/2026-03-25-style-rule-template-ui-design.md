# Style Rule Template UI — Design Spec

**Date:** 2026-03-25
**Status:** Draft

---

## Overview

Replace the raw knowledge-graph form on `/style-rules` with a plain-language template gallery. Users pick a fill-in-the-blank sentence, complete the blanks with free text (with known-value suggestions), choose a strength, and save. The underlying `style_rules` triple structure is invisible.

---

## Problem

The current `StyleRuleForm` exposes fields like "Rule Type", "Predicate", "Subject Type", "Object Type", and a numeric weight input. This is only usable by someone who understands the knowledge graph schema. The goal is zero knowledge-graph exposure for end users.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Creation UX | Template cards | Lowest friction — no rule structure decisions, just fill in blanks |
| Blank input | Free text with suggestions | Expressive (users can name any garment) without locking to known values |
| Weight UX | Always / Often / Sometimes / Rarely | Human language over numbers |
| Existing raw form | Removed entirely | Two creation paths cause confusion; templates are expressive enough |
| Embeddings | Deferred | Engine not built yet; raw text stored as-is, embeddings added later |

---

## Architecture

### Template definitions

Each template is a static TypeScript object that maps a plain-language sentence to a knowledge graph triple. Templates live in a new file: `lib/domain/style-rules/templates.ts`.

```ts
export type RuleTemplate = {
  id: string;                          // stable slug, e.g. "layering-likes"
  category: TemplateCategory;          // used for grouping in the UI
  sentence: string;                    // display text, e.g. "I like layering ___ under ___"
  blanks: BlankDef[];                  // ordered list of blanks in the sentence
  rule_type: string;                   // maps to style_rules.rule_type
  subject_type: string;
  predicate: string;
  object_type: string;
  // subject_value and object_value come from blank[0] and blank[1] respectively
};

export type TemplateCategory =
  | "layering"
  | "colour"
  | "occasions"
  | "season"
  | "silhouette";

export type BlankDef =
  | { kind: "text";  label: string; suggestions: string[] }  // free-text input with suggestion chips
  | { kind: "pick";  label: string; options: string[] }       // mandatory single-choice pill picker (no free text)
  | { kind: "fixed"; value: string };                          // not user-supplied; baked into template definition
```

**Strength → weight mapping** (shared constant):
```ts
export const STRENGTH_WEIGHTS = {
  always:    1.0,
  often:     0.75,
  sometimes: 0.5,
  rarely:    0.25,
} as const;

export type Strength = keyof typeof STRENGTH_WEIGHTS;
```

### Template set

| id | Category | Sentence | subject_type | predicate | object_type | rule_type |
|---|---|---|---|---|---|---|
| `layering-likes` | layering | I like layering ___ under ___ | category | layerable_with | category | layering |
| `layering-avoids` | layering | I don't layer ___ under ___ | category | avoid_layering_with | category | layering |
| `colour-likes` | colour | I like pairing ___ with ___ | colour | pairs_with | colour | colour_pairing |
| `colour-avoids` | colour | I avoid wearing ___ with ___ | colour | avoid_with | colour | colour_pairing |
| `colour-style` | colour | I prefer ___ outfits | preference | prefers | colour_style | colour_preference |
| `occasion-wears` | occasions | I wear ___ for ___ occasions | category | appropriate_for | occasion | occasion_fit |
| `occasion-avoids` | occasions | I don't wear ___ to ___ | category | avoid_for | occasion | occasion_fit |
| `season-wears` | season | I wear ___ in ___ | category | works_in_season | season | seasonality |
| `season-avoids` | season | I avoid ___ in hot weather | category | avoid_in_season | season | seasonality |
| `silhouette-balance` | silhouette | I balance oversized tops with fitted bottoms | fit | balances_with | fit | silhouette |
| `silhouette-prefers` | silhouette | I prefer ___ fits | fit | prefers | fit | silhouette |

**Fixed-value templates** (no free-text blanks, only the strength picker):

- `colour-style`: `subject_value: "preference"` (fixed), `object_value` comes from a single-choice picker rendered inline — one of `"monochrome"`, `"tonal"`, `"contrasting"`. Not free text; rendered as three pill buttons the user taps to select one.
- `silhouette-balance`: `subject_value: "oversized"` (fixed), `object_value: "fitted"` (fixed). Both are fit attributes. The sentence is the full rule — only the strength picker is shown.

**Single-blank templates** where one value is fixed:

- `season-avoids` ("I avoid ___ in hot weather"): `blanks` array has two entries — `blank[0]: { kind: "text", label: "a garment", suggestions: [...] }` (the visible input for `subject_value`) and `blank[1]: { kind: "fixed", value: "hot_weather" }` (never rendered, exists solely to supply `object_value` via the uniform `blank[1]` lookup in the data flow). The sentence has one `___` and one visible blank; the second entry in `blanks` is a hidden fixed carrier.

### Suggestion values per blank type

Suggestions are static arrays passed as `BlankDef.suggestions` in `templates.ts`. No server fetch is needed — all values come from existing constants or are defined inline:

- **garment category** — a static array defined in `lib/domain/style-rules/templates.ts` itself, listing the canonical garment category values used across the app (e.g. `["t-shirt", "shirt", "blazer", "jacket", "coat", "knitwear", "vest", "dress", "jeans", "trousers", "shorts", "skirt", "sneakers", "boots", "loafers", "heels", ...]`). No `garmentCategories` prop needed on the form component — suggestions are baked into the template definitions.
- **colour** — spread of `colourFamilies` from `lib/domain/style-rules/knowledge/colours.ts`. Use `[...colourFamilies]` to convert the `readonly` tuple to `string[]`.
- **occasion** — spread of `occasionProfiles` from `lib/domain/style-rules/knowledge/occasions.ts`. Use `[...occasionProfiles]`.
- **season** — `["summer", "winter", "spring", "autumn"]`
- **fit** — `["relaxed", "fitted", "oversized", "tailored", "slim", "wide-leg", "straight"]`

`StyleRuleTemplateForm` does **not** accept a `garmentCategories` prop — suggestions are embedded in the template definitions.

### Component structure

```
components/
  style-rule-template-form.tsx    NEW — replaces StyleRuleForm
  style-rule-blank-input.tsx      NEW — text input with suggestion chips
```

`StyleRuleTemplateForm` props:
```ts
{
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
}
```

The form renders:
1. Template gallery grouped by `TemplateCategory`
2. One template is active at a time (selected state). Clicking a different template deactivates the current one.
3. Active template shows blank inputs + strength picker
4. Submit maps blank values + strength to `FormData` fields matching the existing `styleRuleFormSchema`

**FormData field mapping:** The existing `createStyleRuleFormAction` and `styleRuleFormSchema` are unchanged. `StyleRuleTemplateForm` submits the same field names (`rule_type`, `subject_type`, `subject_value`, `predicate`, `object_type`, `object_value`, `weight`, `explanation`, `active`). The template fills in the structural fields; the user fills in the value fields; the strength picker fills in `weight`.

The `explanation` field is auto-generated from the filled template sentence (e.g. "I like layering t-shirt under jacket — always") and submitted as a hidden field. The `active` field is submitted as a hidden field with the string value `"on"` — matching the `value === "on"` preprocess in `styleRuleFormSchema`. Submitting `true` or `"true"` would cause the rule to be saved as inactive.

### `StyleRuleBlankInput`

A controlled input component:
- Renders a text `<input>` styled inline with the sentence
- Below the input, renders suggestion chips from `BlankDef.suggestions`
- Clicking a chip sets the input value
- User can also type freely — no validation against suggestions

### Page changes (`app/style-rules/page.tsx`)

- Import `StyleRuleTemplateForm` instead of `StyleRuleForm`
- Remove the `garmentCategories` fetch — not needed (suggestions are baked into templates)
- Remove the `StyleRuleForm` import

### Removed

- `StyleRuleForm` component (`components/style-rule-form.tsx`) — deleted
- The "Rule Logic" and "Explanation" sections with raw triple fields
- The numeric weight input

The `StyleRuleSection` component (display + edit of existing rules) is **unchanged**. Existing user rules can still be edited inline via the card's "Edit Rule" expand — that form continues to use raw fields for now since it pre-populates from the existing rule data.

---

## Data Flow

```
User fills template blanks + picks strength
        ↓
StyleRuleTemplateForm maps to FormData
  rule_type     ← template.rule_type
  subject_type  ← template.subject_type
  subject_value ← blank[0].kind === "text"  → text input value
                  blank[0].kind === "fixed" → blank[0].value
  predicate     ← template.predicate
  object_type   ← template.object_type
  object_value  ← blank[1].kind === "text"  → text input value      (two-blank templates)
                  blank[1].kind === "pick"  → selected pill value    (colour-style)
                  blank[1].kind === "fixed" → blank[1].value         (silhouette-balance, season-avoids)
  weight        ← STRENGTH_WEIGHTS[strength]
  explanation   ← auto-generated sentence string
  active        ← "on" (hidden field, string literal)
        ↓
createStyleRuleFormAction (unchanged)
        ↓
style_rules row inserted
```

---

## Error Handling

- Blank inputs: required. If a blank is empty on submit, the existing Zod validation on `styleRuleFormSchema` catches it (`subject_value` and `object_value` are `min(1)`).
- No template selected: submit button is disabled until a template is active.
- Server errors: existing `FormFeedback` component handles these unchanged.

---

## Testing

- Unit test `lib/domain/style-rules/templates.ts`: verify every template produces a valid `styleRuleFormSchema`-compatible object when blanks are filled with sample values.
- Component test `StyleRuleTemplateForm`: selecting a template activates it; clicking a suggestion chip populates the blank; submitting calls the action with correct field values.
- Existing `createStyleRuleFormAction` tests are unchanged (action signature unchanged).

---

## Notes

**Weight range:** `styleRuleFormSchema` validates `weight` with `max(100)`. `STRENGTH_WEIGHTS` values (0.25–1.0) are well within this ceiling — no validation error will occur. The 0–1 range is intentional for template-created rules; the permissive schema ceiling is not changed.

---

## Out of Scope

- Embedding blank values at save time (deferred — engine not built yet)
- Editing existing rules via templates (existing card edit form unchanged)
- Deleting or reordering templates
- User-created custom templates
