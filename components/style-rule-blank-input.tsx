"use client";

import type { BlankDef } from "@/lib/domain/style-rules/templates";

type TextBlank = Extract<BlankDef, { kind: "text" }>;

export function StyleRuleBlankInput({
  blank,
  value,
  onChange,
  helperText,
}: {
  blank: TextBlank;
  value: string;
  onChange: (value: string) => void;
  helperText?: string | null;
}) {
  return (
    <div className="inline-flex flex-col gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={blank.label}
        className="rounded-2xl border border-[var(--line)] bg-white px-3 py-1.5 text-sm outline-none min-w-[120px]"
      />
      {blank.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-w-xs">
          {blank.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                value === s
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {helperText ? (
        <p className="max-w-xs text-[11px] leading-5 text-[var(--muted)]">{helperText}</p>
      ) : null}
    </div>
  );
}
