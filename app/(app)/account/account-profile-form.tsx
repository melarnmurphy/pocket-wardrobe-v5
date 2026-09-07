"use client";

import { useActionState, useEffect } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { showAppToast } from "@/lib/ui/app-toast";
import {
  updateAccountProfileAction,
  type AccountProfileActionState
} from "@/app/account/actions";

const accountProfileActionState: AccountProfileActionState = {
  status: "idle",
  message: null
};

export function AccountProfileForm({
  email,
  displayName,
  preferredLocation,
  region,
  temperatureUnit,
  currencyUnit
}: {
  email: string | null;
  displayName: string | null;
  preferredLocation: string | null;
  region: "AU" | "NZ";
  temperatureUnit: "C" | "F";
  currencyUnit: "AUD" | "NZD";
}) {
  const [state, formAction] = useActionState<AccountProfileActionState, FormData>(
    updateAccountProfileAction,
    accountProfileActionState
  );

  useEffect(() => {
    if (state.status === "success" && state.message) {
      showAppToast({ tone: "success", message: state.message });
    }
  }, [state.message, state.status]);

  return (
    <form action={formAction} className="pw-panel-soft space-y-5 p-6">
      <div>
        <p className="pw-kicker">Account Info</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
          Keep your planner grounded in a real place.
        </h2>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Name</span>
        <input
          name="display_name"
          defaultValue={displayName ?? ""}
          placeholder="Jane Smith"
          maxLength={80}
          className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--foreground)]"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Email</span>
        <input
          value={email ?? ""}
          readOnly
          className="rounded-[10px] border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-[var(--muted)] outline-none"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Preferred Location</span>
        <input
          name="preferred_location"
          defaultValue={preferredLocation ?? ""}
          placeholder="Adelaide, Sydney, Melbourne..."
          className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--foreground)]"
        />
      </label>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Region</span>
          <select
            name="region"
            defaultValue={region}
            className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--foreground)]"
          >
            <option value="AU">Australia</option>
            <option value="NZ">New Zealand</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Temperature</span>
          <select
            name="temperature_unit"
            defaultValue={temperatureUnit}
            className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--foreground)]"
          >
            <option value="C">Celsius</option>
            <option value="F">Fahrenheit</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Currency</span>
          <select
            name="currency_unit"
            defaultValue={currencyUnit}
            className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--foreground)]"
          >
            <option value="AUD">A$ AUD</option>
            <option value="NZD">$ NZD</option>
          </select>
        </label>
      </div>

      <button type="submit" className="pw-button-primary w-full md:w-auto">
        Save account info
      </button>

      <FormFeedback state={state} />
    </form>
  );
}
