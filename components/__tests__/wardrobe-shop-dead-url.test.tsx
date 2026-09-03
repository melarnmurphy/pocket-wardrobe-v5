// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { WardrobeShop } from "@/components/wardrobe-shop";
import { wardrobeActionState, type WardrobeActionState } from "@/lib/domain/wardrobe/action-state";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/wardrobe",
  useSearchParams: () => new URLSearchParams()
}));

afterEach(cleanup);

const noopAction = async (): Promise<WardrobeActionState> => wardrobeActionState;

/**
 * Regression for finding 4 in the 2026-09-02 final review: a dead product
 * URL's `errorCode: "dead_url"` used to reach only the generic FormFeedback
 * inline error, never the dedicated UploadFailedDialog — mirroring how
 * GarmentImageUpload wires unsupported_format/too_large into that dialog.
 */
describe("WardrobeShop product-url dead-link handling", () => {
  it("shows UploadFailedDialog's dead_url copy when the product-url action reports a dead link", async () => {
    const createProductUrlDraftAction = vi.fn(
      async (): Promise<WardrobeActionState> => ({
        status: "error",
        errorCode: "dead_url",
        message: "That link didn't load, so nothing came back automatically. Add the piece's details yourself instead."
      })
    );

    render(
      <WardrobeShop
        garments={[]}
        planTier="free"
        canUseFeatureLabels={false}
        premiumUpgradeUrl={null}
        billingCheckoutEnabled={false}
        premiumFeatures={[]}
        initialCreateState={{ isOpen: true, sourceMode: "product_url" }}
        createGarmentAction={noopAction}
        createPhotoDraftAction={noopAction}
        createProductUrlDraftAction={createProductUrlDraftAction}
        createReceiptDraftAction={noopAction}
        addGarment3dAssetAction={noopAction}
        addGarmentImageAction={noopAction}
        deleteGarmentAction={noopAction}
        setGarmentFeatureImageAction={noopAction}
        toggleGarmentFavouriteAction={noopAction}
        logWearAction={noopAction}
        updateGarmentAction={noopAction}
        recentlyDeletedGarments={[]}
        collections={[]}
        restoreGarmentAction={noopAction}
        bulkDeleteGarmentsAction={noopAction}
        createCollectionAction={noopAction}
        archiveGarmentAction={noopAction}
      />
    );

    const urlInput = screen.getByPlaceholderText(/https:\/\/example\.com\/products/i);
    fireEvent.change(urlInput, { target: { value: "https://example.com/dead-product" } });

    const submitButton = screen.getByRole("button", { name: /add from link/i });
    fireEvent.click(submitButton);

    await waitFor(() => expect(createProductUrlDraftAction).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/couldn't open that link/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/add manually/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/add manually/i));
    await waitFor(() =>
      expect(screen.queryByText(/couldn't open that link/i)).not.toBeInTheDocument()
    );
  });
});
