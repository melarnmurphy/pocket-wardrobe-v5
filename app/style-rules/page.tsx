import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import {
  createStyleRuleAction,
  deleteStyleRuleAction,
  updateStyleRuleAction
} from "@/app/style-rules/actions";

export default async function StyleRulesPage() {
  try {
    const rules = await listStyleRules();
    const globalRules = rules.filter((rule) => rule.rule_scope === "global");
    const userRules = rules.filter((rule) => rule.rule_scope === "user");

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 md:px-10">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.34em] text-[var(--muted)]">
            Style Rules
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            <span>{globalRules.length} global rules</span>
            <span className="text-[rgba(23,20,17,0.22)]">/</span>
            <span>{userRules.length} user rules</span>
            <span className="text-[rgba(23,20,17,0.22)]">/</span>
            <span>{rules.filter((rule) => rule.active).length} active</span>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <form action={createStyleRuleAction} className="rounded-[1.75rem] border border-[var(--line)] bg-white/65 p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold">Create User Rule</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Add your own inspectable style logic without modifying the global baseline.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Rule Type" name="rule_type" placeholder="colour_pairing" />
              <Field label="Predicate" name="predicate" placeholder="pairs_with" />
              <Field label="Subject Type" name="subject_type" placeholder="category" />
              <Field label="Subject Value" name="subject_value" placeholder="blazer" />
              <Field label="Object Type" name="object_type" placeholder="occasion" />
              <Field label="Object Value" name="object_value" placeholder="business_casual" />
              <Field label="Weight" name="weight" type="number" step="0.01" defaultValue="1" />
            </div>
            <div className="mt-4">
              <TextAreaField label="Explanation" name="explanation" placeholder="Why this rule matters." />
            </div>
            <label className="mt-4 flex items-center gap-3 text-sm">
              <input type="checkbox" name="active" defaultChecked />
              <span>Active</span>
            </label>
            <button type="submit" className="mt-6 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-foreground)]">
              Save User Rule
            </button>
          </form>

          <section className="space-y-6">
            <RuleSection title="Global Rules" rules={globalRules} editable={false} />
            <RuleSection title="User Rules" rules={userRules} editable />
          </section>
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/style-rules"
          title="Sign in with Supabase to use the style rules workspace."
          description="User rule creation and personalized overrides require an authenticated Supabase session."
        />
      );
    }
    throw error;
  }
}

function RuleSection({
  title,
  rules,
  editable
}: {
  title: string;
  rules: Array<{
    id: string;
    rule_type: string;
    subject_type: string;
    subject_value: string;
    predicate: string;
    object_type: string;
    object_value: string;
    weight: number;
    explanation?: string | null;
    active: boolean;
  }>;
  editable?: boolean;
}) {
  return (
    <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/65 p-6">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-5 space-y-4">
        {rules.length ? (
          rules.map((rule) => (
            <article key={rule.id} className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
              <p className="text-sm font-medium">
                {rule.subject_value} {rule.predicate} {rule.object_value}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {rule.rule_type} · {rule.subject_type} to {rule.object_type} · weight {rule.weight}
              </p>
              {rule.explanation ? (
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{rule.explanation}</p>
              ) : null}
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                {rule.active ? "Active" : "Inactive"}
              </p>
              {editable ? (
                <div className="mt-4 space-y-4">
                  <details className="rounded-[1rem] border border-[var(--line)] bg-white/70 p-4">
                    <summary className="cursor-pointer text-sm font-medium">Edit Rule</summary>
                    <form action={updateStyleRuleAction} className="mt-4 space-y-4">
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
                      <button type="submit" className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium">
                        Update Rule
                      </button>
                    </form>
                  </details>
                  <form action={deleteStyleRuleAction}>
                    <input type="hidden" name="id" value={rule.id} />
                    <button type="submit" className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium">
                      Delete Rule
                    </button>
                  </form>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">No rules in this section yet.</p>
        )}
      </div>
    </section>
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
        className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
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
  placeholder,
  defaultValue
}: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        suppressHydrationWarning
        className="min-h-28 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
    </label>
  );
}
