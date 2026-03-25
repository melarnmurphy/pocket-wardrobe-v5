import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractProductMetadataFromUrl,
  parseReceiptDraftCandidates
} from "@/lib/domain/ingestion/extractors";

describe("parseReceiptDraftCandidates", () => {
  it("extracts likely garment lines from receipt text", () => {
    const result = parseReceiptDraftCandidates({
      receiptText: `
        Boutique Store
        Wool blazer $249.00
        Silk cami $89.00
        Subtotal $338.00
      `
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.title.toLowerCase()).toContain("wool blazer");
    expect(result[1]?.category).toBe("cami");
    expect(result[0]?.retailer).toBe("Boutique Store");
    expect(result[0]?.price).toBe(249);
    expect(result[0]?.currency).toBe("AUD");
  });

  it("falls back to the provided title when no item lines are detected", () => {
    const result = parseReceiptDraftCandidates({
      receiptText: "Thank you for shopping with us",
      fallbackTitle: "Scanned receipt"
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Scanned receipt");
  });

  it("infers retailer-brand metadata from named fashion receipts", () => {
    const result = parseReceiptDraftCandidates({
      receiptText: `
        DAVID JONES
        Black knit dress AUD 189.00
        Total AUD 189.00
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.brand).toBe("David Jones");
    expect(result[0]?.retailer).toBe("David Jones");
    expect(result[0]?.currency).toBe("AUD");
    expect(result[0]?.price).toBe(189);
  });

  it("keeps the store brand and strips the prefix on Viktoria & Woods receipts", () => {
    const result = parseReceiptDraftCandidates({
      receiptText: `
        VIKTORIA & WOODS
        VIKTORIA & WOODS COCO KNIT TOP AUD 249.00
        Total AUD 249.00
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.brand).toBe("Viktoria & Woods");
    expect(result[0]?.retailer).toBe("Viktoria & Woods");
    expect(result[0]?.title).toBe("COCO KNIT TOP");
    expect(result[0]?.price).toBe(249);
  });

  it("splits brand and item title on Myer-style lines", () => {
    const result = parseReceiptDraftCandidates({
      receiptText: `
        MYER
        Basque Wool Blend Blazer AUD 179.95
        Total AUD 179.95
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.brand).toBe("Basque");
    expect(result[0]?.retailer).toBe("Myer");
    expect(result[0]?.title).toBe("Wool Blend Blazer");
    expect(result[0]?.price).toBe(179.95);
  });
});

describe("extractProductMetadataFromUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("derives a fallback title and category from the URL when fetch fails", async () => {
    const result = await extractProductMetadataFromUrl(
      "https://example.com/products/ivory-oversized-blazer"
    );

    expect(result.title?.toLowerCase()).toContain("ivory oversized blazer");
    expect(result.category).toBe("blazer");
    expect(result.colour).toBe("ivory");
  });

  it("uses the farfetch adapter when host-specific metadata is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta property="og:title" content="Wool Blazer" />
              <meta name="description" content="Sharp tailoring." />
            </head>
            <body>
              <script type="application/ld+json">
                {"offers":{"price":"540","priceCurrency":"AUD"}}
              </script>
              <script>
                window.__DATA__={"designerName":"Wardrobe NYC","price":"540","currency":"AUD"};
              </script>
            </body>
          </html>
        `
      })
    );

    const result = await extractProductMetadataFromUrl(
      "https://www.farfetch.com/au/shopping/women/wool-blazer-item-123.aspx"
    );

    expect(result.title).toBe("Wool Blazer");
    expect(result.brand).toBe("Wardrobe NYC");
    expect(result.price).toBe("540");
    expect(result.currency).toBe("AUD");
  });
});
