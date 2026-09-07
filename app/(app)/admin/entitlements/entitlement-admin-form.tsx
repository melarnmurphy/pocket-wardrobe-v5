"use client";

import { useActionState, useEffect } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { showAppToast } from "@/lib/ui/app-toast";
import {
  adminEntitlementActionState,
  saveEntitlementAction,
  type AdminEntitlementActionState
} from "@/app/admin/entitlements/actions";

export function EntitlementAdminForm() {
  const [state, formAction] = useActionState<AdminEntitlementActionState, FormData>(
    saveEntitlementAction,
    adminEntitlementActionState
  );

  useEffect(() => {
    if (state.status === "success" && state.message) {
      showAppToast({ message: state.message, tone: "success" });
    }
  }, [state.message, state.status]);

  return (
    <form action={formAction} className="pw-panel-soft space-y-5 p-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
          Manual Entitlements
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
          Grant or revoke plans directly
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Use this before billing exists. It writes to <code>user_entitlements</code> through the
          same sync service used by the billing webhook scaffold.
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">User Email</span>
        <input
          name="user_email"
          type="email"
          placeholder="you@example.com"
          className="rounded-[8px] border border-[var(--line)] bg-white px-4 py-3 outline-none"
        />
      </label>

      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        <span className="h-px flex-1 bg-[var(--line)]" />
        <span>or</span>
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">User ID</span>
        <input
          name="user_id"
          placeholder="00000000-0000-0000-0000-000000000000"
          className="rounded-[8px] border border-[var(--line)] bg-white px-4 py-3 outline-none"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Plan Tier</span>
        <select
          name="plan_tier"
          defaultValue="premium"
          className="rounded-[8px] border border-[var(--line)] bg-white px-4 py-3 outline-none"
        >
          <option value="free">free</option>
          <option value="pro">pro</option>
          <option value="premium">premium</option>
        </select>
      </label>

      <button
        type="submit"
        className="pw-button-primary"
      >
        Save Entitlements
      </button>

      <FormFeedback state={state} />
    </form>
  );
}
