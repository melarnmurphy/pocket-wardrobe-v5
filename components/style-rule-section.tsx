"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { DestructiveActionButton } from "@/components/destructive-action-button";
import { FormFeedback } from "@/components/form-feedback";
import { showAppToast } from "@/lib/ui/app-toast";
import type { StyleRuleListItem } from "@/lib/domain/style-rules/service";
import type {
  SemanticSuggestionMatch,
  SupportedStyleRuleValueType
} from "@/lib/domain/style-rules/semantic-matching";
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
            <RuleEditForm
              rule={rule}
              action={updateFormAction}
              state={updateState}
            />
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

type PreviewState = {
  loading: boolean;
  match: SemanticSuggestionMatch | null;
};

function isPreviewableType(value: string): value is SupportedStyleRuleValueType {
  return (
    value === "category" ||
    value === "colour" ||
    value === "colour_family" ||
    value === "occasion" ||
    value === "season"
  );
}

function buildPreviewHelperText(
  match: SemanticSuggestionMatch | null,
  currentValue: string
): string | null {
  if (!match) {
    return null;
  }

  if (match.resolved === currentValue.trim()) {
    return null;
  }

  if (match.method === "exact") {
    return `Will save as "${match.resolved}".`;
  }

  return `Will likely save as "${match.resolved}" (${Math.round(match.score * 100)}% semantic match).`;
}

function RuleEditForm({
  rule,
  action,
  state
}: {
  rule: StyleRuleListItem;
  action: (formData: FormData) => void;
  state: FormActionState;
}) {
  const [subjectType, setSubjectType] = useState(rule.subject_type);
  const [subjectValue, setSubjectValue] = useState(rule.subject_value);
  const [objectType, setObjectType] = useState(rule.object_type);
  const [objectValue, setObjectValue] = useState(rule.object_value);
  const [previewStateByField, setPreviewStateByField] = useState<Record<"subject" | "object", PreviewState>>({
    subject: { loading: false, match: null },
    object: { loading: false, match: null }
  });

  useEffect(() => {
    setSubjectType(rule.subject_type);
    setSubjectValue(rule.subject_value);
    setObjectType(rule.object_type);
    setObjectValue(rule.object_value);
    setPreviewStateByField({
      subject: { loading: false, match: null },
      object: { loading: false, match: null }
    });
  }, [rule.id, rule.object_type, rule.object_value, rule.subject_type, rule.subject_value]);

  useEffect(() => {
    const requests = [
      { key: "subject" as const, type: subjectType, value: subjectValue },
      { key: "object" as const, type: objectType, value: objectValue }
    ].filter(
      (request): request is {
        key: "subject" | "object";
        type: SupportedStyleRuleValueType;
        value: string;
      } => isPreviewableType(request.type) && request.value.trim().length > 0
    );

    const requestKeys = new Set(requests.map((request) => request.key));
    setPreviewStateByField((previous) => ({
      subject: requestKeys.has("subject") ? previous.subject : { loading: false, match: null },
      object: requestKeys.has("object") ? previous.object : { loading: false, match: null }
    }));

    if (requests.length === 0) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setPreviewStateByField((previous) => {
        const next = { ...previous };
        for (const request of requests) {
          next[request.key] = {
            loading: true,
            match: previous[request.key].match
          };
        }
        return next;
      });

      await Promise.all(
        requests.map(async (request) => {
          try {
            const response = await fetch("/api/style-rules/normalize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: request.type,
                value: request.value
              }),
              signal: controller.signal
            });

            const payload = (await response.json()) as {
              match?: SemanticSuggestionMatch | null;
            };

            if (!response.ok) {
              throw new Error("normalize_failed");
            }

            setPreviewStateByField((previous) => ({
              ...previous,
              [request.key]: {
                loading: false,
                match: payload.match ?? null
              }
            }));
          } catch (error) {
            if ((error as Error).name === "AbortError") {
              return;
            }

            setPreviewStateByField((previous) => ({
              ...previous,
              [request.key]: {
                loading: false,
                match: null
              }
            }));
          }
        })
      );
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [objectType, objectValue, subjectType, subjectValue]);

  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="id" value={rule.id} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Rule Type" name="rule_type" defaultValue={rule.rule_type} />
        <Field label="Predicate" name="predicate" defaultValue={rule.predicate} />
        <ControlledField
          label="Subject Type"
          name="subject_type"
          value={subjectType}
          onChange={setSubjectType}
        />
        <ControlledField
          label="Subject Value"
          name="subject_value"
          value={subjectValue}
          onChange={setSubjectValue}
          helperText={
            previewStateByField.subject.loading
              ? "Checking canonical match..."
              : buildPreviewHelperText(previewStateByField.subject.match, subjectValue)
          }
        />
        <ControlledField
          label="Object Type"
          name="object_type"
          value={objectType}
          onChange={setObjectType}
        />
        <ControlledField
          label="Object Value"
          name="object_value"
          value={objectValue}
          onChange={setObjectValue}
          helperText={
            previewStateByField.object.loading
              ? "Checking canonical match..."
              : buildPreviewHelperText(previewStateByField.object.match, objectValue)
          }
        />
        <Field label="Weight" name="weight" type="number" step="0.01" defaultValue={String(rule.weight)} />
      </div>
      <TextAreaField label="Explanation" name="explanation" defaultValue={rule.explanation || ""} />
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={rule.active} />
        <span>Active</span>
      </label>
      <SubmitButton idle="Update Rule" pending="Updating..." tone="light" />
      <FormFeedback state={state} className="mt-3" />
    </form>
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

function ControlledField({
  label,
  name,
  value,
  onChange,
  type = "text",
  helperText
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  helperText?: string | null;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <input
        className="rounded-[8px] border border-[var(--line)] bg-white px-4 py-3 outline-none"
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {helperText ? (
        <span className="text-[11px] leading-5 text-[var(--muted)]">{helperText}</span>
      ) : null}
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
