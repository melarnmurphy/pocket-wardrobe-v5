import type { ButtonHTMLAttributes } from "react";

type PillButtonVariant = "primary" | "neutral" | "secondary" | "on-blush";

type PillButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PillButtonVariant;
  fullWidth?: boolean;
};

const VARIANT_CLASSES: Record<PillButtonVariant, string> = {
  primary: "bg-[var(--oxblood)] text-[var(--cream)]",
  neutral: "bg-[var(--ink)] text-[var(--cream)]",
  secondary: "border border-[rgba(30,26,23,.22)] bg-transparent text-[var(--ink)]",
  "on-blush": "bg-[var(--blush)] text-[var(--blush-ink)]"
};

/** The pill button primitive: 52px tall, 100px radius, uppercase micro-label. */
export function PillButton({
  variant = "primary",
  fullWidth = true,
  className = "",
  children,
  ...props
}: PillButtonProps) {
  return (
    <button
      {...props}
      className={[
        "inline-flex h-[52px] items-center justify-center gap-2 rounded-[100px] px-6",
        "font-semibold text-[9.5px] uppercase tracking-[.2em]",
        "transition-transform duration-150 ease-out active:scale-[.98]",
        "disabled:opacity-40 disabled:pointer-events-none",
        fullWidth ? "w-full" : "",
        VARIANT_CLASSES[variant],
        className
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** Text-only link-style action: 500 weight, oxblood, underlined. */
export function TextLink(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <button
      {...rest}
      className={[
        "inline-flex h-[52px] items-center justify-center text-[12.5px] font-medium text-[var(--oxblood)] underline",
        className
      ].join(" ")}
    >
      {children}
    </button>
  );
}
