// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NotificationPermissionDialog } from "@/components/garderobe/wardrobe/notification-permission-dialog";

describe("NotificationPermissionDialog", () => {
  afterEach(() => cleanup());

  it("explains the trade and offers 'not now'", () => {
    render(<NotificationPermissionDialog open onTurnOn={() => {}} onNotNow={() => {}} />);
    expect(screen.getByText(/not now/i)).toBeInTheDocument();
  });

  it("calls onTurnOn when 'turn on' is chosen", () => {
    const onTurnOn = vi.fn();
    render(<NotificationPermissionDialog open onTurnOn={onTurnOn} onNotNow={() => {}} />);
    fireEvent.click(screen.getByText(/turn on/i));
    expect(onTurnOn).toHaveBeenCalled();
  });
});
