// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UploadFailedDialog } from "@/components/garderobe/wardrobe/upload-failed-dialog";

describe("UploadFailedDialog", () => {
  it("shows HEIC-specific copy for an unsupported format", () => {
    render(
      <UploadFailedDialog open errorCode="unsupported_format" onClose={() => {}} onRetry={() => {}} />
    );
    expect(screen.getByText(/that file type won't open/i)).toBeInTheDocument();
  });

  it("shows a size-cap message for too_large", () => {
    render(<UploadFailedDialog open errorCode="too_large" onClose={() => {}} onRetry={() => {}} />);
    expect(screen.getByText(/too large/i)).toBeInTheDocument();
  });

  it("offers 'add manually' for a dead url, and calls onRetry when chosen", () => {
    const onRetry = vi.fn();
    render(<UploadFailedDialog open errorCode="dead_url" onClose={() => {}} onRetry={onRetry} />);
    fireEvent.click(screen.getByText(/add manually/i));
    expect(onRetry).toHaveBeenCalled();
  });
});
