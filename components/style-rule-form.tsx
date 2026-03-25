"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { FormFeedback } from "@/components/form-feedback";
import { showAppToast } from "@/lib/ui/app-toast";
import { formActionState, type FormActionState } from "@/lib/ui/form-action-state";

export function StyleRuleForm({
  action
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(action, formActionState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      showAppToast({
        message: state.message || "Style rule saved",
        tone: "success"
      });
    }
  }, [state.message, state.status]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="pw-panel-soft p-6 md:p-7"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Create User Rule</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
          Add your own inspectable style logic without modifying the global baseline.
        </p>
      </div>
      <div className="space-y-6">
        <section className="rounded-[8px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,243,255,0.92))] p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Rule Logic
              </p>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">
                Define the relationship in a way that stays machine-readable and explainable.
              </p>
            </div>
            <span className="pw-chip">
              Structured first
            </span>
          </div>

          <div className="mt-6 grid gap-x-4 gap-y-5 md:grid-cols-2">
            <Field label="Rule Type" name="rule_type" placeholder="colour_pairing" />
            <Field label="Predicate" name="predicate" placeholder="pairs_with" />
            <Field label="Subject Type" name="subject_type" placeholder="category" />
            <Field label="Subject Value" name="subject_value" placeholder="blazer" />
            <Field label="Object Type" name="object_type" placeholder="occasion" />
            <Field label="Object Value" name="object_value" placeholder="business_casual" />
            <Field label="Weight" name="weight" type="number" step="0.01" defaultValue="1" />
          </div>
        </section>

        <details className="pw-panel-soft p-5 md:p-6">
          <summary className="cursor-pointer text-sm font-medium">Explanation</summary>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
            Add the human-readable reasoning for why the rule should influence outfit logic.
          </p>

          <div className="mt-6">
            <TextAreaField label="Explanation" name="explanation" placeholder="Why this rule matters." />
          </div>
          <label className="mt-4 flex items-center gap-3 text-sm">
            <input type="checkbox" name="active" defaultChecked />
            <span>Active</span>
          </label>
        </details>
      </div>
      <div className="mt-7 border-t border-[var(--line)] pt-5">
        <SubmitButton idle="Save User Rule" pending="Saving Rule..." />
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  step
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <input
        suppressHydrationWarning
        className="rounded-[8px] border border-[var(--line)] bg-white px-4 py-3 outline-none"
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        step={step}
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  placeholder
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        suppressHydrationWarning
        className="min-h-28 rounded-[8px] border border-[var(--line)] bg-white px-4 py-3 outline-none"
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

function SubmitButton({ idle, pending }: { idle: string; pending: string }) {
  const { pending: isPending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={isPending}
      className="pw-button-primary mt-6 disabled:transform-none disabled:opacity-60 disabled:shadow-none"
    >
      {isPending ? pending : idle}
    </button>
  );
}
