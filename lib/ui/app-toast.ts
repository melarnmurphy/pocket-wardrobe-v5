"use client";

export type AppToastDetail = {
  id?: string;
  message: string;
  tone?: "success" | "error" | "info";
};

export function showAppToast(detail: AppToastDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<AppToastDetail>("app-toast", { detail }));
}

export function dismissAppToast(id: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AppToastDetail>("app-toast-dismiss", {
      detail: { id, message: "" }
    })
  );
}
