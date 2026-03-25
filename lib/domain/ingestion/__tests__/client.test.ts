import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const validGarment = {
  category: "shirt/blouse",
  confidence: 0.87,
  bbox: [10, 20, 100, 200],
  colour: "navy",
  colour_conf: 0.9,
  material: "cotton",
  material_conf: 0.7,
  style: "casual",
  style_conf: 0.8,
  tag: "navy cotton shirt/blouse",
  embedding: Array(768).fill(0.1),
};

describe("callPipelineService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("downloads image, posts multipart to /analyse, returns parsed response", async () => {
    const { callPipelineService } = await import("@/lib/domain/ingestion/client");

    // First fetch: download image from signed URL
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["image-data"], { type: "image/jpeg" }),
    });

    // Second fetch: call Modal /analyse
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        filename: "image.jpg",
        garment_count: 1,
        garments: [validGarment],
      }),
    });

    const result = await callPipelineService({
      serviceUrl: "https://example--fashion-pipeline-api.modal.run",
      imageUrl: "https://supabase.example.com/signed/image.jpg",
      threshold: 0.5,
    });

    expect(result.garments).toHaveLength(1);
    expect(result.garments[0].colour).toBe("navy");

    // Second call should hit the /analyse endpoint
    const [analyseUrl, analyseOpts] = mockFetch.mock.calls[1];
    expect(analyseUrl).toBe(
      "https://example--fashion-pipeline-api.modal.run/analyse?threshold=0.5"
    );
    expect((analyseOpts as RequestInit).method).toBe("POST");
    expect((analyseOpts as RequestInit).body).toBeInstanceOf(FormData);
  });

  it("throws if image download fails", async () => {
    const { callPipelineService } = await import("@/lib/domain/ingestion/client");

    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    await expect(
      callPipelineService({
        serviceUrl: "https://example--fashion-pipeline-api.modal.run",
        imageUrl: "https://supabase.example.com/expired.jpg",
      })
    ).rejects.toThrow("Failed to fetch image: 403");
  });

  it("throws if pipeline service returns non-ok", async () => {
    const { callPipelineService } = await import("@/lib/domain/ingestion/client");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["img"]),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    });

    await expect(
      callPipelineService({
        serviceUrl: "https://example--fashion-pipeline-api.modal.run",
        imageUrl: "https://supabase.example.com/image.jpg",
      })
    ).rejects.toThrow("Pipeline service error: 503");
  });
});

describe("callReceiptOcrService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts multipart to /receipt-ocr and returns OCR text from JSON payload", async () => {
    const { callReceiptOcrService } = await import("@/lib/domain/ingestion/client");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ receipt_text: "MYER\nBasque Wool Blend Blazer AUD 179.95" }),
    });

    const result = await callReceiptOcrService({
      serviceUrl: "https://example--fashion-pipeline-api.modal.run",
      file: new File(["receipt-image"], "receipt.jpg", { type: "image/jpeg" }),
    });

    expect(result).toContain("Basque Wool Blend Blazer");

    const [ocrUrl, ocrOpts] = mockFetch.mock.calls[0];
    expect(ocrUrl).toBe("https://example--fashion-pipeline-api.modal.run/receipt-ocr");
    expect((ocrOpts as RequestInit).method).toBe("POST");
    expect((ocrOpts as RequestInit).body).toBeInstanceOf(FormData);
  });

  it("throws if OCR service returns non-ok", async () => {
    const { callReceiptOcrService } = await import("@/lib/domain/ingestion/client");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    });

    await expect(
      callReceiptOcrService({
        serviceUrl: "https://example--fashion-pipeline-api.modal.run",
        file: new File(["receipt-image"], "receipt.jpg", { type: "image/jpeg" }),
      })
    ).rejects.toThrow("Receipt OCR service error: 503");
  });
});
