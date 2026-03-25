"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { DestructiveActionButton } from "@/components/destructive-action-button";
import { FormFeedback } from "@/components/form-feedback";
import { showAppToast } from "@/lib/ui/app-toast";
import type { StyleRuleListItem } from "@/lib/domain/style-rules/service";
import { formActionState, type FormActionState } from "@/lib/ui/form-action-state";

export function StyleRuleSection({
  title,
  rules,
  editable,
  updateAction,
  deleteAction
}: {
  title: string;
  rules: StyleRuleListItem[];
  editable?: boolean;
  updateAction: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  deleteAction: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
}) {
  return (
    <section className="pw-panel-soft p-6">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {rules.length ? (
          rules.map((rule) => (
            <StyleRuleCard
              key={rule.id}
              rule={rule}
              editable={editable}
              updateAction={updateAction}
              deleteAction={deleteAction}
            />
          ))
        ) : (
          <p className="pw-empty-state text-sm text-[var(--muted)] lg:col-span-2">
            No rules in this section yet.
          </p>
        )}
      </div>
    </section>
  );
}

function StyleRuleCard({
  rule,
  editable,
  updateAction,
  deleteAction
}: {
  rule: StyleRuleListItem;
  editable?: boolean;
  updateAction: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  deleteAction: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
}) {
  const [updateState, updateFormAction] = useActionState(updateAction, formActionState);
  const [deleteState, deleteFormAction] = useActionState(deleteAction, formActionState);

  useEffect(() => {
    if (updateState.status === "success") {
      showAppToast({
        message: updateState.message || "Style rule updated",
        tone: "success"
      });
    }
  }, [updateState.message, updateState.status]);

  useEffect(() => {
    if (deleteState.status === "success") {
      showAppToast({
        message: deleteState.message || "Style rule deleted",
        tone: "success"
      });
    }
  }, [deleteState.message, deleteState.status]);

  return (
    <article className="rounded-[8px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,243,255,0.92))] p-5 shadow-[0_18px_40px_rgba(45,27,105,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            {rule.rule_type.replaceAll("_", " ")}
          </p>
          <h3 className="text-lg font-semibold tracking-[-0.02em]">
            {rule.subject_value} {rule.predicate} {rule.object_value}
          </h3>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.18em] ${
            rule.active
              ? "bg-[rgba(13,255,232,0.12)] text-[var(--trend-accent-ink)]"
              : "bg-[rgba(45,27,105,0.06)] text-[var(--muted)]"
          }`}
        >
          {rule.active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <RuleChip label={rule.subject_type} tone="light" />
        <RuleChip label={rule.object_type} tone="light" />
        <RuleChip label={`weight ${rule.weight}`} tone="weight" />
        {editable ? <RuleChip label="User rule" tone="user" /> : <RuleChip label="Global" tone="global" />}
      </div>

      {rule.explanation ? (
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{rule.explanation}</p>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">No explanation added yet.</p>
      )}

      {editable ? (
        <div className="mt-4 space-y-4">
          <details className="pw-panel-soft p-4">
            <summary className="cursor-pointer text-sm font-medium">Edit Rule</summary>
            <form action={updateFormAction} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={rule.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Rule Type" name="rule_type" defaultValue={rule.rule_type} />
                <Field label="Predicate" name="predicate" defaultValue={rule.predicate} />
                <Field label="Subject Type" name="subject_type" defaultValue={rule.subject_type} />
                <Field label="Subject Value" name="subject_value" defaultValue={rule.subject_value} />
                <Field label="Object Type" name="object_type" defaultValue={rule.object_type} />
                <Field label="Object Value" name="object_value" defaultValue={rule.object_value} />
                <Field label="Weight" name="weight" type="number" step="0.01" defaultValue={String(rule.weight)} />
              </div>
              <TextAreaField label="Explanation" name="explanation" defaultValue={rule.explanation || ""} />
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="active" defaultChecked={rule.active} />
                <span>Active</span>
              </label>
              <SubmitButton idle="Update Rule" pending="Updating..." tone="light" />
              <FormFeedback state={updateState} className="mt-3" />
            </form>
          </details>
          <form action={deleteFormAction}>
            <input type="hidden" name="id" value={rule.id} />
            <DestructiveActionButton idleLabel="Delete Rule" pendingLabel="Deleting..." />
            <FormFeedback state={deleteState} className="mt-3" />
          </form>
        </div>
      ) : null}
    </article>
  );
}

function RuleChip({
  label,
  tone
}: {
  label: string;
  tone: "light" | "weight" | "user" | "global";
}) {
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.14em] ${
        tone === "weight"
          ? "bg-[rgba(45,27,105,0.06)] text-[var(--muted)]"
          : tone === "user"
            ? "bg-[rgba(255,107,157,0.12)] text-[var(--accent-strong)]"
            : tone === "global"
              ? "bg-[rgba(123,92,240,0.12)] text-[var(--accent-strong)]"
              : "border border-[var(--line)] bg-white/82 text-[var(--muted)]"
      }`}
    >
      {label.replaceAll("_", " ")}
    </span>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  step
}: {
  label: string;
  name: string;
  type?: string;
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
        defaultValue={defaultValue}
        step={step}
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        suppressHydrationWarning
        className="min-h-28 rounded-[8px] border border-[var(--line)] bg-white px-4 py-3 outline-none"
        name={name}
        defaultValue={defaultValue}
      />
    </label>
  );
}

function SubmitButton({
  idle,
  pending,
  tone
}: {
  idle: string;
  pending: string;
  tone: "light";
}) {
  const { pending: isPending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={isPending}
      className={`pw-button-quiet px-4 py-2 text-sm disabled:transform-none disabled:opacity-60 disabled:shadow-none ${
        tone === "light" ? "bg-white" : ""
      }`}
    >
      {isPending ? pending : idle}
    </button>
  );
}
