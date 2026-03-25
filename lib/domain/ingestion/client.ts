import { pipelineAnalyzeResponseSchema, type PipelineAnalyzeResponse } from "./index";

export interface CallPipelineServiceParams {
  serviceUrl: string;
  imageUrl: string;
  threshold?: number;
}

export async function callPipelineService(
  params: CallPipelineServiceParams
): Promise<PipelineAnalyzeResponse> {
  const { serviceUrl, imageUrl, threshold = 0.5 } = params;

  // Download the image from the signed Supabase URL
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  }
  const imageBlob = await imageResponse.blob();

  // Re-upload as multipart to Modal's /analyse endpoint
  const formData = new FormData();
  formData.append("file", imageBlob, "image.jpg");

  const response = await fetch(
    `${serviceUrl}/analyse?threshold=${threshold}`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Pipeline service error: ${response.status}${text ? ` — ${text}` : ""}`);
  }

  // Modal returns { filename, garment_count, garments: [...] }
  // Extract garments and validate against our schema
  const raw = await response.json() as Record<string, unknown>;
  return pipelineAnalyzeResponseSchema.parse({ garments: raw["garments"] ?? [] });
}

export interface CallReceiptOcrServiceParams {
  serviceUrl: string;
  file: File;
}

export async function callReceiptOcrService(
  params: CallReceiptOcrServiceParams
): Promise<string> {
  const formData = new FormData();
  formData.append("file", params.file, params.file.name || "receipt");

  const response = await fetch(`${params.serviceUrl}/receipt-ocr`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Receipt OCR service error: ${response.status}${text ? ` — ${text}` : ""}`);
  }

  const rawText = await response.text();
  const parsed = tryParseJson(rawText);

  if (parsed && typeof parsed === "object") {
    const candidate = [parsed.text, parsed.receipt_text, parsed.raw_text, parsed.markdown].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    );

    if (candidate) {
      return candidate.trim();
    }
  }

  if (rawText.trim().length > 0) {
    return rawText.trim();
  }

  throw new Error("Receipt OCR service returned no text.");
}

function tryParseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
