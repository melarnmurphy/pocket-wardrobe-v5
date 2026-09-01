"use client";

import { AlertTriangle, Check, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { PillToast } from "@/components/garderobe";
import { dismissAppToast, type AppToastDetail } from "@/lib/ui/app-toast";

type ToastItem = AppToastDetail & {
  id: string;
};

const TOAST_ICONS = {
  success: Check,
  error: AlertTriangle,
  info: Info
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
        message: detail.message,
        actionLabel: detail.actionLabel,
        onAction: detail.onAction
      };

      setToasts((current) => [...current, nextToast]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== nextToast.id));
      }, detail.actionLabel ? 5200 : 3200);
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
          const Icon = TOAST_ICONS[toast.tone ?? "success"];

          return (
            <div key={toast.id} className="pointer-events-auto w-full">
              <PillToast
                message={toast.message}
                actionLabel={toast.actionLabel}
                icon={<Icon size={13} strokeWidth={1.5} />}
                onAction={() => {
                  toast.onAction?.();
                  dismissAppToast(toast.id);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
