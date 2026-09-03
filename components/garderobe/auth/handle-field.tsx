"use client";

type HandleFieldStatus = "idle" | "checking" | "available" | "taken";

type HandleFieldProps = {
  value: string;
  status: HandleFieldStatus;
};

/**
 * w5d — the @handle input, matching the visual pattern drawn there (an
 * `available` pill to the right of the value). MODALS.md §6 notes only the
 * positive state was drawn; this adds `taken`.
 *
 * Not wired to a live form: Garderobe has no handle/username column yet
 * (see `types/database.ts`'s `profiles` table), so there is nothing to
 * check a value against. This component is ready to drop into a sign-up
 * or account form once that feature exists and a real availability check
 * is built alongside it.
 */
export function HandleField({ value, status }: HandleFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--ink)]">handle</span>
      <div className="flex h-12 items-center gap-1 rounded-[4px] border border-[var(--line)] bg-white px-3.5">
        <span className="text-[14.5px] text-[var(--stone)]">@</span>
        <span className="text-[14.5px] text-[var(--ink)]">{value}</span>
        {status === "available" ? (
          <span className="ml-auto text-[11px] font-medium text-[#4f6350]">available</span>
        ) : null}
        {status === "taken" ? (
          <span className="ml-auto text-[11px] font-medium text-red-700">already taken, try another</span>
        ) : null}
        {status === "checking" ? (
          <span className="ml-auto text-[11px] font-medium text-[var(--stone)]">checking...</span>
        ) : null}
      </div>
    </div>
  );
}
