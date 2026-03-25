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
import type { FormActionState } from "@/lib/ui/form-action-state";

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
  for (let i = 0; i < template.blanks.length; i++) {
    const blank = template.blanks[i];
    if (blank.kind !== "fixed") {
      rendered.push(values[i as 0 | 1]);
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
  const initialState: FormActionState = { status: "idle", message: null };
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(action, initialState);

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
      const current: [string, string] = prev[templateId] ?? ["", ""];
      const updated: [string, string] = [current[0], current[1]];
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
