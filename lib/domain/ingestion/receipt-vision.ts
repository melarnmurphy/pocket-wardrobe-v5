import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";

// Vision-based receipt OCR. Transcribes a photographed receipt to raw text so
// the downstream parser (parseReceiptDraftCandidates) can extract items, brands,
// prices, and retailer. Runs in the Next.js server layer using the same OpenAI
// SDK + gpt-4o-mini model the trends/style-rules domains already use, so no
// external pipeline service is required.
const RECEIPT_OCR_MODEL = "gpt-4o-mini";

const TRANSCRIBE_PROMPT =
  "Transcribe ALL text from this purchase receipt verbatim, line by line, " +
  "preserving item names, brands, prices, currency codes/symbols, quantities, " +
  "the retailer name, and totals exactly as printed. Do not summarise, " +
  "interpret, translate, or add commentary. Output only the raw transcribed text.";

/**
 * Extract raw text from a photographed receipt using a vision LLM.
 *
 * Only images are supported — the model is given the image inline as a base64
 * data URL. Non-image inputs (e.g. PDF) throw so callers can fall back to their
 * other text sources (the receipt action wraps this in `.catch(() => null)`).
 */
export async function extractReceiptTextWithVision(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Receipt vision OCR requires an image file.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  const client = new OpenAI({ apiKey: getServerEnv().OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: RECEIPT_OCR_MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: TRANSCRIBE_PROMPT },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "";
  const text = stripCodeFence(raw);
  if (!text) {
    throw new Error("Receipt vision OCR returned no text.");
  }

  return text;
}

/**
 * Models sometimes wrap transcriptions in a ``` markdown fence. Strip a
 * surrounding fence (with optional language tag) so downstream receipt parsing
 * doesn't treat the fence line as the retailer or an item.
 */
function stripCodeFence(value: string): string {
  const fenced = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(value.trim());
  return (fenced ? fenced[1] : value).trim();
}
