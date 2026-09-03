// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ThreadView } from "@/app/local/threads/[id]/thread-view";

// jsdom doesn't implement scrollIntoView; thread-view calls it on mount to
// keep the message list pinned to the bottom, so it needs a stub here.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// vitest.config.ts doesn't enable `test.globals`, so testing-library's
// automatic afterEach cleanup never registers itself. Without this, each
// render in this file leaves its DOM behind for the next test.
afterEach(cleanup);

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: vi.fn() })
}));
vi.mock("@/app/local/actions", () => ({
  sendMessageAction: vi.fn(async () => ({ status: "success" })),
  proposeHandoverAction: vi.fn(async () => ({ status: "success" })),
  respondToHandoverAction: vi.fn(async () => ({ status: "success" })),
  confirmHandoverAction: vi.fn(async () => ({ status: "success" })),
  blockUserAction: vi.fn(async () => ({ status: "success" })),
  reportListingAction: vi.fn(async () => ({ status: "success" })),
  respondToOfferAction: vi.fn(async () => ({ status: "success" })),
  withdrawOfferAction: vi.fn(async () => ({ status: "success" })),
  cancelHandoverAction: vi.fn(async () => ({ status: "success" })),
  reportNoShowAction: vi.fn(async () => ({ status: "success" }))
}));

const baseThread = {
  id: "11111111-1111-1111-1111-111111111111",
  listing_id: "22222222-2222-2222-2222-222222222222",
  buyer_id: "33333333-3333-3333-3333-333333333333",
  seller_id: "44444444-4444-4444-4444-444444444444",
  state: "open",
  last_message_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z"
};

describe("ThreadView block and report", () => {
  it("opens a real dialog for block, not window.confirm", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    render(
      <ThreadView
        viewerId={baseThread.buyer_id}
        thread={baseThread}
        initialMessages={[]}
        initialHandover={null}
        counterpartName="sam"
      />
    );

    fireEvent.click(screen.getByText("block"));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/block sam\?/i)).toBeInTheDocument();
  });

  it("opens a real sheet for report, not window.prompt", () => {
    const promptSpy = vi.spyOn(window, "prompt");
    render(
      <ThreadView
        viewerId={baseThread.buyer_id}
        thread={baseThread}
        initialMessages={[]}
        initialHandover={null}
        counterpartName="sam"
      />
    );

    fireEvent.click(screen.getByText("report"));
    expect(promptSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/report this listing/i)).toBeInTheDocument();
  });

  it("offers decline on a pending offer message from the counterpart", () => {
    render(
      <ThreadView
        viewerId={baseThread.seller_id}
        thread={baseThread}
        initialMessages={[
          {
            id: "55555555-5555-5555-5555-555555555555",
            thread_id: baseThread.id,
            sender_id: baseThread.buyer_id,
            kind: "offer",
            body: "",
            offer_cents: 18500,
            offer_status: "pending",
            sent_at: "2026-01-01T00:00:00Z",
            read_at: null
          }
        ]}
        initialHandover={null}
        counterpartName="sam"
      />
    );

    fireEvent.click(screen.getByText("decline"));
    expect(screen.getByText(/decline this offer\?/i)).toBeInTheDocument();
  });
});
