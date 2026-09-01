import type { ButtonHTMLAttributes } from "react";

type ChipVariant = "available" | "selected" | "applied" | "add" | "good-news";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ChipVariant;
};

const VARIANT_CLASSES: Record<ChipVariant, string> = {
  available: "border border-[rgba(30,26,23,.2)] text-[var(--slate)]",
  selected: "bg-[var(--ink)] text-[var(--cream)]",
  applied: "border border-[rgba(109,42,36,.22)] bg-[#f0e6e2] text-[var(--oxblood)]",
  add: "border border-dashed border-[rgba(30,26,23,.3)] text-[var(--stone)]",
  "good-news": "bg-[var(--blush)] text-[var(--blush-ink)]"
};

/** The chip primitive: pill, 7×12 padding, text centred. */
export function Chip({ variant = "available", className = "", children, ...props }: ChipProps) {
  return (
    <button
      {...props}
      className={[
        "inline-flex items-center justify-center rounded-[100px] px-3 py-[7px]",
        "text-[11px] font-medium",
        VARIANT_CLASSES[variant],
        className
      ].join(" ")}
    >
      {children}
    </button>
  );
}
