// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PickerSheet } from "@/components/garderobe/wardrobe/picker-sheet";

describe("PickerSheet", () => {
  it("calls onSelect with the chosen option", () => {
    const onSelect = vi.fn();
    render(
      <PickerSheet
        open
        title="fabric"
        options={["cotton", "wool", "silk"]}
        value="cotton"
        onSelect={onSelect}
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getByText("wool"));
    expect(onSelect).toHaveBeenCalledWith("wool");
  });
});
