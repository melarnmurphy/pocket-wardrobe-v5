// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ChoosePhotosPage from "../page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

// Create a mock localStorage implementation
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("ChoosePhotosPage - PhotoLibraryPermissionDialog integration", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows PhotoLibraryPermissionDialog on first visit when no localStorage flag is set", () => {
    render(<ChoosePhotosPage />);
    const dropzone = screen.getByRole("button", { name: /drop photos/i });

    // Dialog should NOT be visible initially
    expect(screen.queryByText(/garderobe needs your photos/i)).not.toBeInTheDocument();

    // Click the dropzone to trigger the picker
    fireEvent.click(dropzone);

    // Dialog SHOULD now be visible
    expect(screen.getByText(/garderobe needs your photos/i)).toBeInTheDocument();
    expect(screen.getByText(/allow access/i)).toBeInTheDocument();
  });

  it("clicking 'allow access' sets the localStorage flag and opens the file picker", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    render(<ChoosePhotosPage />);
    const dropzone = screen.getByRole("button", { name: /drop photos/i });

    // First click shows the dialog
    fireEvent.click(dropzone);
    expect(screen.getByText(/garderobe needs your photos/i)).toBeInTheDocument();

    // Click "allow access"
    const allowButton = screen.getByText(/allow access/i);
    fireEvent.click(allowButton);

    // Flag should be set
    expect(localStorage.getItem("gw.photoLibraryPermissionGranted")).toBe("1");

    // File picker should have been opened
    expect(clickSpy).toHaveBeenCalled();

    // Dialog should close
    expect(screen.queryByText(/garderobe needs your photos/i)).not.toBeInTheDocument();

    clickSpy.mockRestore();
  });

  it("clicking 'not now' does NOT set the localStorage flag, allowing the dialog to re-appear on next visit", () => {
    render(<ChoosePhotosPage />);
    const dropzone = screen.getByRole("button", { name: /drop photos/i });

    // First click shows the dialog
    fireEvent.click(dropzone);
    expect(screen.getByText(/garderobe needs your photos/i)).toBeInTheDocument();

    // Click "not now"
    const notNowButton = screen.getByText(/not now/i);
    fireEvent.click(notNowButton);

    // Flag should NOT be set
    expect(localStorage.getItem("gw.photoLibraryPermissionGranted")).toBeNull();

    // Dialog should close
    expect(screen.queryByText(/garderobe needs your photos/i)).not.toBeInTheDocument();

    // Click dropzone again
    fireEvent.click(dropzone);

    // Dialog should appear again since flag wasn't set
    expect(screen.getByText(/garderobe needs your photos/i)).toBeInTheDocument();
  });

  it("when localStorage flag is pre-set, clicking the dropzone opens the file picker directly without showing the dialog", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    // Pre-set the localStorage flag
    localStorage.setItem("gw.photoLibraryPermissionGranted", "1");

    render(<ChoosePhotosPage />);
    const dropzone = screen.getByRole("button", { name: /drop photos/i });

    // Click the dropzone
    fireEvent.click(dropzone);

    // Dialog should NOT appear
    expect(screen.queryByText(/garderobe needs your photos/i)).not.toBeInTheDocument();

    // File picker should have been opened
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
  });
});
