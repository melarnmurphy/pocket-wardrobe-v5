"use client";

import type { FormActionState } from "@/lib/ui/form-action-state";

export function FormFeedback({
  state,
  className = "mt-4"
}: {
  state: FormActionState | { status: "idle" | "success" | "error" | "partial"; message: string | null };
  className?: string;
}) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={`${className} rounded-[1rem] border px-4 py-3 text-sm ${
        state.status === "error" || state.status === "partial"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-[var(--line)] bg-[rgba(255,255,255,0.82)] text-[var(--muted)]"
      }`}
    >
      {state.message}
    </p>
  );
}
