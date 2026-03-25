"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

export function DestructiveActionButton({
  idleLabel,
  pendingLabel,
  confirmLabel = "Confirm delete",
  className = "pw-button-danger px-4 py-2 text-sm",
  confirmClassName = "rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-[0_10px_24px_rgba(185,28,28,0.18)]",
  hintAlign = "right",
  buttonType = "submit",
  onConfirm
}: {
  idleLabel: string;
  pendingLabel: string;
  confirmLabel?: string;
  className?: string;
  confirmClassName?: string;
  hintAlign?: "left" | "right";
  buttonType?: "submit" | "button";
  onConfirm?: () => void;
}) {
  const { pending } = useFormStatus();
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!isConfirming) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsConfirming(false);
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [isConfirming]);

  return (
    <div className="relative inline-flex">
      <button
        type={buttonType}
        disabled={pending}
        onClick={(event) => {
          if (pending) {
            return;
          }

          if (!isConfirming) {
            event.preventDefault();
            setIsConfirming(true);
            return;
          }

          if (onConfirm) {
            event.preventDefault();
            onConfirm();
          }

          setIsConfirming(false);
        }}
        className={`${isConfirming ? confirmClassName : className} transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(45,27,105,0.1)] active:translate-y-0 active:scale-[0.98] disabled:transform-none disabled:opacity-60 disabled:shadow-none`}
      >
        <span className="inline-flex items-center gap-2">
          <TrashIcon />
          {pending ? pendingLabel : isConfirming ? confirmLabel : idleLabel}
        </span>
      </button>

      {isConfirming && !pending ? (
        <p
          className={`absolute top-full mt-2 rounded-full bg-[var(--accent-strong)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(45,27,105,0.18)] ${
            hintAlign === "left" ? "left-0" : "right-0"
          }`}
        >
          {confirmLabel}
        </p>
      ) : null}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
      <path d="M7.8 2.8h4.4l.5 1.4H16v1.6H4V4.2h3.3l.5-1.4Zm-1.9 4.4h8.2l-.6 9.1a1.7 1.7 0 0 1-1.7 1.6H8.2a1.7 1.7 0 0 1-1.7-1.6l-.6-9.1Zm2.2 1.7v6.8h1.5V8.9H8.1Zm2.3 0v6.8h1.5V8.9h-1.5Z" />
    </svg>
  );
}
