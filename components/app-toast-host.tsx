"use client";

import { useEffect, useState } from "react";
import { dismissAppToast, type AppToastDetail } from "@/lib/ui/app-toast";

type ToastItem = AppToastDetail & {
  id: string;
};

const toastStyles = {
  success: {
    shell: "border-[var(--line)] bg-[rgba(255,255,255,0.94)] text-[var(--foreground)]",
    icon: "bg-[rgba(13,255,232,0.14)] text-[var(--trend-accent-ink)]"
  },
  error: {
    shell: "border-red-200 bg-[rgba(255,245,245,0.96)] text-red-700",
    icon: "bg-red-100 text-red-600"
  },
  info: {
    shell: "border-[var(--line)] bg-[rgba(245,243,255,0.96)] text-[var(--foreground)]",
    icon: "bg-[rgba(123,92,240,0.12)] text-[var(--accent-strong)]"
  }
} as const;

export function AppToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const customEvent = event as CustomEvent<AppToastDetail>;
      const detail = customEvent.detail;

      if (!detail?.message) {
        return;
      }

      const nextToast: ToastItem = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        tone: detail.tone ?? "success",
        message: detail.message
      };

      setToasts((current) => [...current, nextToast]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== nextToast.id));
      }, 3200);
    };

    const handleDismiss = (event: Event) => {
      const customEvent = event as CustomEvent<AppToastDetail>;
      const toastId = customEvent.detail?.id;

      if (!toastId) {
        return;
      }

      setToasts((current) => current.filter((toast) => toast.id !== toastId));
    };

    window.addEventListener("app-toast", handleToast);
    window.addEventListener("app-toast-dismiss", handleDismiss);

    return () => {
      window.removeEventListener("app-toast", handleToast);
      window.removeEventListener("app-toast-dismiss", handleDismiss);
    };
  }, []);

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[80] flex justify-center px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-3">
        {toasts.map((toast) => {
          const style = toastStyles[toast.tone ?? "success"];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex w-full items-center gap-3 rounded-[8px] border px-4 py-3 shadow-[0_18px_40px_rgba(45,27,105,0.14)] backdrop-blur-xl ${style.shell}`}
            >
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.icon}`}
              >
                {toast.tone === "error" ? <ErrorIcon /> : toast.tone === "info" ? <InfoIcon /> : <CheckIcon />}
              </span>
              <p className="flex-1 text-sm font-medium">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismissAppToast(toast.id)}
                className="rounded-full p-1 text-[var(--muted)] transition-colors hover:bg-black/5 hover:text-[var(--foreground)]"
                aria-label="Dismiss toast"
              >
                <CloseIcon />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
      <path d="m7.9 13.3-3.2-3.2-1.4 1.4 4.6 4.6L16.8 7l-1.4-1.4-7.5 7.7Z" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
      <path d="M10 1.7a8.3 8.3 0 1 0 0 16.6A8.3 8.3 0 0 0 10 1.7Zm.9 11.5H9.1V15h1.8v-1.8Zm0-8.2H9.1V11h1.8V5Z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
      <path d="M10 1.7a8.3 8.3 0 1 0 0 16.6A8.3 8.3 0 0 0 10 1.7Zm.9 12.1H9.1V8h1.8v5.8Zm0-7.4H9.1V4.6h1.8v1.8Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
      <path d="m11.4 10 4.3-4.3-1.4-1.4-4.3 4.3-4.3-4.3-1.4 1.4L8.6 10l-4.3 4.3 1.4 1.4 4.3-4.3 4.3 4.3 1.4-1.4-4.3-4.3Z" />
    </svg>
  );
}
