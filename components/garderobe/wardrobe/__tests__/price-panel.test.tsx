// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricePanel } from "@/components/garderobe/wardrobe/price-panel";

const noopAction = async (state: unknown) => state as never;

describe("PricePanel", () => {
  it("shows 'add later' rather than A$0 when there is no price", () => {
    render(
      <PricePanel
        garmentId="99999999-9999-9999-9999-999999999999"
        currentPrice={null}
        currentCurrency={null}
        mode="panel"
        setPriceAction={noopAction}
      />
    );

    expect(screen.getByText(/add later/i)).toBeInTheDocument();
    expect(screen.queryByText("A$0.00")).not.toBeInTheDocument();
  });
});
