import { Check } from "lucide-react";
import type { ReactNode } from "react";

type PillToastProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
};

/** The pill toast primitive: dark ink pill, 22px icon, one action, never a close button. */
export function PillToast({ message, actionLabel, onAction, icon }: PillToastProps) {
  return (
    <div className="gw-pop flex items-center gap-3 rounded-[100px] bg-[var(--ink)] px-[18px] py-[13px]">
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--blush)] text-[var(--blush-ink)]">
        {icon ?? <Check size={13} strokeWidth={1.5} />}
      </span>
      <span className="flex-1 text-[13px] leading-[1.3] text-[var(--cream)]">{message}</span>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="text-[8.5px] font-semibold uppercase tracking-[.16em] text-[var(--blush)]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
