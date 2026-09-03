// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MessageSellerGate } from "@/components/garderobe/local-threads/message-seller-gate";

const startThreadActionMock = vi.fn(async (_listingId: string, _body: string) => {});
vi.mock("@/app/local/actions", () => ({
  startThreadAction: (listingId: string, body: string) => startThreadActionMock(listingId, body),
  confirmAgeAction: vi.fn(async () => {}),
  declineAgeAction: vi.fn(async () => {}),
  markSafetyBriefSeenAction: vi.fn(async () => {})
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() })
}));

afterEach(cleanup);

describe("MessageSellerGate", () => {
  it("blocks the message form behind the age check when age is unconfirmed", () => {
    render(
      <MessageSellerGate listingId="11111111-1111-1111-1111-111111111111" ageConfirmed={false} ageDeclined={false} safetyBriefSeen={false} />
    );

    expect(screen.getByText(/confirm you're 18 or over/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /message the seller/i })).not.toBeInTheDocument();
  });

  it("shows the permanent block, with buyer-relevant copy, once age has been declined", () => {
    render(
      <MessageSellerGate listingId="11111111-1111-1111-1111-111111111111" ageConfirmed={false} ageDeclined safetyBriefSeen={false} />
    );

    expect(screen.getByText(/needs an adult/i)).toBeInTheDocument();
    expect(screen.getByText(/messaging a seller stays off/i)).toBeInTheDocument();
  });

  it("renders the message form once both gates are already satisfied", () => {
    render(
      <MessageSellerGate listingId="11111111-1111-1111-1111-111111111111" ageConfirmed safetyBriefSeen ageDeclined={false} />
    );

    expect(screen.getByRole("button", { name: /message the seller/i })).toBeInTheDocument();
  });

  it("submits the message to startThreadAction with the listing id once past the gates", () => {
    render(
      <MessageSellerGate listingId="22222222-2222-2222-2222-222222222222" ageConfirmed safetyBriefSeen ageDeclined={false} />
    );

    fireEvent.change(screen.getByPlaceholderText(/is this still available/i), {
      target: { value: "is this still available?" }
    });
    fireEvent.click(screen.getByRole("button", { name: /message the seller/i }));
  });
});
