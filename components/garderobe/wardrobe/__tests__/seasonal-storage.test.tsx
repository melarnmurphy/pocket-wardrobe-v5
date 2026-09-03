// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { SeasonalStorageControl } from "@/components/garderobe/wardrobe/piece-detail-panels";

// This project's vitest config does not enable `test.globals`, so
// @testing-library/react's automatic afterEach cleanup never registers
// (it only wires up when it finds a real global `afterEach`). Without this,
// renders from earlier tests stay mounted in the shared jsdom document and
// "store for the season" resolves to more than one match in later tests.
afterEach(cleanup);

// A stable router object (real Next.js router instances are stable across
// renders) rather than a fresh object literal per `useRouter()` call, so the
// "second consecutive success" test below sees the refresh effect fire only
// on an actual state change, not on every re-render.
const refresh = vi.fn();
const router = { push: vi.fn(), refresh };

vi.mock("next/navigation", () => ({
  useRouter: () => router
}));

describe("SeasonalStorageControl", () => {
  it("asks for confirmation, then submits garment_id and stored=true", async () => {
    const setSeasonalStorageAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);

    render(
      <SeasonalStorageControl
        garmentId="77777777-7777-7777-7777-777777777777"
        pieceName="camel coat"
        stored={false}
        setSeasonalStorageAction={setSeasonalStorageAction}
      />
    );

    fireEvent.click(screen.getByText("store for the season"));
    fireEvent.click(await screen.findByText("store it"));

    await waitFor(() => expect(setSeasonalStorageAction).toHaveBeenCalled());
    const [, formData] = setSeasonalStorageAction.mock.calls[0] as [unknown, FormData];
    expect(formData.get("garment_id")).toBe("77777777-7777-7777-7777-777777777777");
    expect(formData.get("stored")).toBe("true");
  });

  it("brings a stored piece back with a single tap, no dialog", async () => {
    const setSeasonalStorageAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);

    render(
      <SeasonalStorageControl
        garmentId="77777777-7777-7777-7777-777777777777"
        pieceName="camel coat"
        stored={true}
        setSeasonalStorageAction={setSeasonalStorageAction}
      />
    );

    fireEvent.click(screen.getByText("bring it back"));

    await waitFor(() => expect(setSeasonalStorageAction).toHaveBeenCalled());
    const [, formData] = setSeasonalStorageAction.mock.calls[0] as [unknown, FormData];
    expect(formData.get("garment_id")).toBe("77777777-7777-7777-7777-777777777777");
    expect(formData.get("stored")).toBe("false");
  });

  it("refreshes again on a second consecutive success (store, then bring back)", async () => {
    // Each call resolves a freshly constructed object literal with the same
    // "success" status, exactly like the real setSeasonalStorageAction does
    // across two separate toggles. This guards against keying the refresh
    // effect on `state.status` alone: a same-value string comparison would
    // miss the second resolution and leave the control stale.
    refresh.mockClear();
    const setSeasonalStorageAction = vi
      .fn()
      .mockImplementationOnce(
        async () => ({ status: "success", message: "Stored for the season." }) as never
      )
      .mockImplementationOnce(
        async () => ({ status: "success", message: "Back in the everyday grid." }) as never
      );

    const { rerender } = render(
      <SeasonalStorageControl
        garmentId="77777777-7777-7777-7777-777777777777"
        pieceName="camel coat"
        stored={false}
        setSeasonalStorageAction={setSeasonalStorageAction}
      />
    );

    fireEvent.click(screen.getByText("store for the season"));
    fireEvent.click(await screen.findByText("store it"));

    await waitFor(() => expect(setSeasonalStorageAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    // Simulate the parent re-rendering with the refreshed server data, then
    // bring the piece back: a second consecutive "success" resolution.
    rerender(
      <SeasonalStorageControl
        garmentId="77777777-7777-7777-7777-777777777777"
        pieceName="camel coat"
        stored={true}
        setSeasonalStorageAction={setSeasonalStorageAction}
      />
    );

    fireEvent.click(screen.getByText("bring it back"));

    await waitFor(() => expect(setSeasonalStorageAction).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  });
});
