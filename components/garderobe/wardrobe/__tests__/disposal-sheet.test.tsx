// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DisposalSheet } from "@/components/garderobe/wardrobe/disposal-sheet";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

const noopAction = async (state: unknown) => state as never;

describe("DisposalSheet", () => {
  it("never nests a button inside a button for each disposal reason", () => {
    render(
      <DisposalSheet open garmentId="99999999-9999-9999-9999-999999999999" onClose={() => {}} archiveAction={noopAction} />
    );

    const soldButton = screen.getByRole("button", { name: /sold/i });
    // The reason option itself must be the outer <button type="submit">, with
    // no second <button> nested inside it (invalid HTML — buttons can't
    // contain interactive content, and it creates duplicate tab stops).
    expect(soldButton.tagName).toBe("BUTTON");
    expect(soldButton.querySelector("button")).toBeNull();
  });
});
