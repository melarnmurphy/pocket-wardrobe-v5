// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SeasonalStorageControl } from "@/components/garderobe/wardrobe/piece-detail-panels";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
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
});
