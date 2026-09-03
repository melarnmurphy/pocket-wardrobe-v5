"use client";

import { showAppToast } from "@/lib/ui/app-toast";

type DataExportRequest = {
  id: string;
  requestedAt: string;
  readyAt: string | null;
  status: "requested" | "ready";
};

type ExportRowProps = {
  requestAction: () => Promise<{ status: "success" | "error"; message: string | null }>;
  /**
   * Polls for the latest request's ready state. In production nothing
   * currently sets ready_at, since no export pipeline exists yet. This
   * checks once immediately after a request so the "export ready" toast
   * fires the moment a real export worker flips it, without a page reload.
   */
  checkAction: () => Promise<DataExportRequest | null>;
};

/** MODALS.md §5, "export started / export ready" toast. */
export function ExportRow({ requestAction, checkAction }: ExportRowProps) {
  async function handleRequest() {
    const result = await requestAction();

    if (result.status === "error") {
      showAppToast({ tone: "error", message: result.message ?? "Could not start your export." });
      return;
    }

    showAppToast({ tone: "success", message: result.message ?? "Export started." });

    const latest = await checkAction();
    if (latest?.readyAt) {
      showAppToast({ tone: "success", message: "Your export is ready to download." });
    }
  }

  return (
    <div className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
      <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
        your data
      </p>
      <button
        type="button"
        onClick={() => void handleRequest()}
        className="text-[14.5px] text-[var(--ink)] underline underline-offset-2"
      >
        export your data
      </button>
    </div>
  );
}
