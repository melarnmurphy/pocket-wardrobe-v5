// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PhotoLibraryPermissionDialog } from "@/components/garderobe/wardrobe/photo-library-permission-dialog";

describe("PhotoLibraryPermissionDialog", () => {
  afterEach(() => cleanup());

  it("explains the trade in one line and offers 'not now'", () => {
    render(<PhotoLibraryPermissionDialog open onAllow={() => {}} onNotNow={() => {}} />);
    expect(screen.getByText(/garderobe needs your photos/i)).toBeInTheDocument();
    expect(screen.getByText(/not now/i)).toBeInTheDocument();
  });

  it("calls onAllow when 'allow access' is chosen", () => {
    const onAllow = vi.fn();
    render(<PhotoLibraryPermissionDialog open onAllow={onAllow} onNotNow={() => {}} />);
    fireEvent.click(screen.getByText(/allow access/i));
    expect(onAllow).toHaveBeenCalled();
  });
});
