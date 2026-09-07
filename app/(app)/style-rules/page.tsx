import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { StyleRuleTemplateForm } from "@/components/style-rule-template-form";
import { StyleRuleSection } from "@/components/style-rule-section";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import {
  createStyleRuleFormAction,
  deleteStyleRuleFormAction,
  updateStyleRuleFormAction
} from "@/app/style-rules/actions";

export default async function StyleRulesPage() {
  try {
    const rules = await listStyleRules();
    const globalRules = rules.filter((rule) => rule.rule_scope === "global");
    const userRules = rules.filter((rule) => rule.rule_scope === "user");

    return (
      <main className="pw-shell flex min-h-screen max-w-7xl flex-col gap-8 md:px-10">
        <div className="pw-page-head">
          <div className="space-y-3">
            <p className="pw-kicker">Style Rules</p>
            <h1 className="pw-page-title">Turn taste into inspectable logic.</h1>
            <p className="pw-page-copy">
              Keep outfit generation explainable by writing fashion rules as structured constraints, not vague prompts.
            </p>
          </div>
          <div className="pw-meta-row">
            <span>{globalRules.length} global rules</span>
            <span className="divider">/</span>
            <span>{userRules.length} user rules</span>
            <span className="divider">/</span>
            <span>{rules.filter((rule) => rule.active).length} active</span>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <StyleRuleTemplateForm action={createStyleRuleFormAction} />

          <section className="space-y-6">
            <StyleRuleSection
              title="Global Rules"
              rules={globalRules}
              editable={false}
              updateAction={updateStyleRuleFormAction}
              deleteAction={deleteStyleRuleFormAction}
            />
            <StyleRuleSection
              title="User Rules"
              rules={userRules}
              editable
              updateAction={updateStyleRuleFormAction}
              deleteAction={deleteStyleRuleFormAction}
            />
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
