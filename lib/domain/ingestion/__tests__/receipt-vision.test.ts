import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: createMock } };
  },
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ OPENAI_API_KEY: "test-key" }),
}));

describe("extractReceiptTextWithVision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the image as a base64 data URL to gpt-4o-mini and returns transcribed text", async () => {
    const { extractReceiptTextWithVision } = await import(
      "@/lib/domain/ingestion/receipt-vision"
    );

    createMock.mockResolvedValueOnce({
      choices: [
        { message: { content: "MYER\nBasque Wool Blend Blazer AUD 179.95\n" } },
      ],
    });

    const file = new File([new Uint8Array([1, 2, 3])], "receipt.jpg", {
      type: "image/jpeg",
    });
    const result = await extractReceiptTextWithVision(file);

    // Returns trimmed transcription
    expect(result).toBe("MYER\nBasque Wool Blend Blazer AUD 179.95");

    // Calls vision-capable model with the image inlined as a base64 data URL
    const callArg = createMock.mock.calls[0][0] as {
      model: string;
      messages: { content: Array<{ type: string; image_url?: { url: string } }> }[];
    };
    expect(callArg.model).toBe("gpt-4o-mini");
    const imagePart = callArg.messages[0].content.find(
      (part) => part.type === "image_url"
    );
    expect(imagePart?.image_url?.url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("strips a surrounding markdown code fence from the model output", async () => {
    const { extractReceiptTextWithVision } = await import(
      "@/lib/domain/ingestion/receipt-vision"
    );

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "```\nMYER\nCountry Road Wool Coat AUD 299.95\n```",
          },
        },
      ],
    });

    const file = new File([new Uint8Array([1])], "receipt.jpg", {
      type: "image/jpeg",
    });
    const result = await extractReceiptTextWithVision(file);

    expect(result).not.toContain("```");
    expect(result.startsWith("MYER")).toBe(true);
    expect(result).toContain("Country Road Wool Coat AUD 299.95");
  });

  it("throws when the model returns empty text", async () => {
    const { extractReceiptTextWithVision } = await import(
      "@/lib/domain/ingestion/receipt-vision"
    );

    createMock.mockResolvedValueOnce({ choices: [{ message: { content: "" } }] });

    const file = new File([new Uint8Array([1])], "receipt.jpg", {
      type: "image/jpeg",
    });
    await expect(extractReceiptTextWithVision(file)).rejects.toThrow("no text");
  });

  it("throws for non-image files (e.g. PDF) so callers can fall back", async () => {
    const { extractReceiptTextWithVision } = await import(
      "@/lib/domain/ingestion/receipt-vision"
    );

    const file = new File([new Uint8Array([1])], "receipt.pdf", {
      type: "application/pdf",
    });
    await expect(extractReceiptTextWithVision(file)).rejects.toThrow("image");
    expect(createMock).not.toHaveBeenCalled();
  });
});
