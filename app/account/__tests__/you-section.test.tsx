// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { YouSection } from "@/app/account/you-section";

// vitest.config.ts doesn't enable test.globals, so testing-library's
// automatic afterEach cleanup never registers itself; without this, each
// render in this file leaves its DOM behind for the next test.
afterEach(cleanup);

vi.mock("@/app/account/profile-actions", () => ({
  updateProfileAction: vi.fn(async (state: unknown) => state),
  updateSizesAction: vi.fn(async (state: unknown) => state),
  updateLocalPrivacyAction: vi.fn(async (state: unknown) => state)
}));
vi.mock("@/app/local/actions", () => ({
  unblockUserAction: vi.fn(async () => ({ status: "success" }))
}));
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock })
}));

const profile = {
  local_name: "esther",
  suburb: "norwood",
  tops_size: null,
  bottoms_size: null,
  shoes_size: null,
  tops_size_system: "AU",
  bottoms_size_system: "AU",
  shoes_size_system: "AU",
  height_cm: null,
  one_size_either_way: false,
  show_suburb: true,
  show_wear_count: true,
  user_id: "11111111-1111-1111-1111-111111111111",
  suburb_lat: null,
  suburb_lng: null,
  radius_km: 30,
  onboarding_completed_at: null,
  local_safety_brief_seen_at: null,
  age_confirmed_at: null,
  age_declined_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z"
};

const preview = {
  userId: "11111111-1111-1111-1111-111111111111",
  localName: "esther",
  suburb: "norwood",
  avatarUri: null,
  joinedAt: "2026-01-01T00:00:00Z",
  handoverCount: 0,
  listedCount: 0
};

describe("YouSection blocked list", () => {
  it("shows the empty state when nobody is blocked", () => {
    render(<YouSection profile={profile as never} preview={preview} blockedUsers={[]} />);
    expect(screen.getByText(/blocked · 0/i)).toBeInTheDocument();
    expect(screen.getByText(/haven't blocked anyone/i)).toBeInTheDocument();
  });

  it("lists a blocked user with an unblock action", () => {
    render(
      <YouSection
        profile={profile as never}
        preview={preview}
        blockedUsers={[{ userId: "33333333-3333-3333-3333-333333333333", localName: "sam", blockedAt: "2026-01-01T00:00:00Z" }]}
      />
    );
    expect(screen.getByText(/blocked · 1/i)).toBeInTheDocument();
    expect(screen.getByText("sam")).toBeInTheDocument();
    fireEvent.click(screen.getByText("unblock"));
  });

  it("refreshes the page after a successful unblock, so the row disappears without a manual reload", async () => {
    render(
      <YouSection
        profile={profile as never}
        preview={preview}
        blockedUsers={[{ userId: "33333333-3333-3333-3333-333333333333", localName: "sam", blockedAt: "2026-01-01T00:00:00Z" }]}
      />
    );
    fireEvent.click(screen.getByText("unblock"));
    await vi.waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});
