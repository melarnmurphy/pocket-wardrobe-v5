// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  FieldPickerControl,
  MergeControl,
  type GarmentFieldSnapshot
} from "@/components/garderobe/wardrobe/piece-detail-panels";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

const baseSnapshot: GarmentFieldSnapshot = {
  garment_id: "99999999-9999-9999-9999-999999999999",
  title: "Navy jumper",
  brand: "Uniqlo",
  category: "tops",
  subcategory: null,
  material: "wool",
  size: "M",
  fit: null,
  formality_level: null,
  purchase_currency: "AUD",
  purchase_price: 89,
  purchase_date: null,
  retailer: null,
  primary_colour_family: "blue",
  seasonality: ["winter"]
};

describe("FieldPickerControl", () => {
  it("submits the whole garment snapshot with just the chosen field overridden", async () => {
    const updateAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);

    render(
      <FieldPickerControl
        label="fabric"
        field="material"
        value="wool"
        options={["wool", "cotton", "linen"]}
        snapshot={baseSnapshot}
        updateAction={updateAction}
      />
    );

    fireEvent.click(screen.getByText("wool"));
    fireEvent.click(await screen.findByText("cotton"));

    await waitFor(() => expect(updateAction).toHaveBeenCalled());
    const [, formData] = updateAction.mock.calls[0] as [unknown, FormData];
    expect(formData.get("garment_id")).toBe(baseSnapshot.garment_id);
    expect(formData.get("material")).toBe("cotton");
    // Untouched fields must round-trip unchanged, since updateGarmentAction
    // replaces the whole row rather than patching one field.
    expect(formData.get("category")).toBe("tops");
    expect(formData.get("brand")).toBe("Uniqlo");
    expect(formData.getAll("seasonality")).toEqual(["winter"]);
  });
});

describe("MergeControl", () => {
  it("submits the source and chosen target garment ids after confirming", async () => {
    const mergeAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);

    render(
      <MergeControl
        sourceGarmentId="11111111-1111-1111-1111-111111111111"
        sourceTitle="Navy jumper"
        targets={[
          { id: "22222222-2222-2222-2222-222222222222", title: "Grey jumper" },
          { id: "33333333-3333-3333-3333-333333333333", title: "Black coat" }
        ]}
        mergeAction={mergeAction}
      />
    );

    fireEvent.click(screen.getByText("merge with another piece"));
    fireEvent.click(await screen.findByText("Grey jumper"));
    fireEvent.click(await screen.findByText("merge"));

    await waitFor(() => expect(mergeAction).toHaveBeenCalled());
    const [, formData] = mergeAction.mock.calls[0] as [unknown, FormData];
    expect(formData.get("source_garment_id")).toBe("11111111-1111-1111-1111-111111111111");
    expect(formData.get("target_garment_id")).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("renders nothing when there are no other garments to merge into", () => {
    const { container } = render(
      <MergeControl
        sourceGarmentId="11111111-1111-1111-1111-111111111111"
        sourceTitle="Navy jumper"
        targets={[]}
        mergeAction={vi.fn(async (state: unknown) => state as never)}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
