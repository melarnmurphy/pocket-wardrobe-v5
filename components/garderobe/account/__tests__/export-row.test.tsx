// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ExportRow } from "@/components/garderobe/account/export-row";

vi.mock("@/lib/ui/app-toast", () => ({ showAppToast: vi.fn() }));

describe("ExportRow", () => {
  afterEach(() => {
    cleanup();
  });

  it("fires the export-started toast on request", async () => {
    const { showAppToast } = await import("@/lib/ui/app-toast");
    const requestAction = vi.fn().mockResolvedValue({
      status: "success",
      message: "We're packaging your export. We'll let you know when it's ready."
    });
    const checkAction = vi.fn().mockResolvedValue(null);

    render(<ExportRow requestAction={requestAction} checkAction={checkAction} />);
    fireEvent.click(screen.getByRole("button", { name: /export your data/i }));

    await waitFor(() => expect(requestAction).toHaveBeenCalled());
    await waitFor(() =>
      expect(showAppToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: "success", message: expect.stringMatching(/packaging your export/i) })
      )
    );
  });

  it("fires the export-ready toast once the latest request has a ready_at", async () => {
    const { showAppToast } = await import("@/lib/ui/app-toast");
    const requestAction = vi.fn().mockResolvedValue({ status: "success", message: "started" });
    const checkAction = vi.fn().mockResolvedValue({
      id: "req1",
      requestedAt: "2026-09-02T00:00:00.000Z",
      readyAt: "2026-09-02T01:00:00.000Z",
      status: "ready"
    });

    render(<ExportRow requestAction={requestAction} checkAction={checkAction} />);
    fireEvent.click(screen.getByRole("button", { name: /export your data/i }));

    await waitFor(() => expect(checkAction).toHaveBeenCalled());
    await waitFor(() =>
      expect(showAppToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: "success", message: expect.stringMatching(/export is ready/i) })
      )
    );
  });
});
