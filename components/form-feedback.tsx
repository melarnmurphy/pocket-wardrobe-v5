"use client";

import type { FormActionState } from "@/lib/ui/form-action-state";

export function FormFeedback({
  state,
  className = "mt-4"
}: {
  state:
    | FormActionState
    | { status: "idle" | "success" | "error" | "partial" | "blocked"; message: string | null };
  className?: string;
}) {
  if (!state.message) {
    return null;
  }

  const isProblem = state.status === "error" || state.status === "partial" || state.status === "blocked";

  return (
    <p
      role={isProblem ? "alert" : "status"}
      aria-live="polite"
      className={`${className} flex items-start gap-3 rounded-[6px] border px-4 py-3 text-[12.5px] leading-[1.45] ${
        isProblem
          ? "border-[rgba(109,42,36,.2)] bg-[var(--blush)] text-[var(--blush-ink)]"
          : "border-[var(--line)] bg-[rgba(255,255,255,0.82)] text-[var(--muted)]"
      }`}
    >
      <span aria-hidden="true" className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${isProblem ? "bg-[var(--oxblood)]" : "bg-[var(--sage)]"}`} />
      <span>{state.message}</span>
    </p>
  );
}
