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

  const url = new URL("/analyse", serviceUrl);
  url.searchParams.set("threshold", String(threshold));

  const response = await fetch(url, { method: "POST", body: formData });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Pipeline service error: ${response.status}${text ? ` — ${text}` : ""}`);
  }

  // Modal returns { filename, garment_count, garments: [...] }
  // Extract garments and validate against our schema
  const raw = await response.json() as Record<string, unknown>;
  return pipelineAnalyzeResponseSchema.parse({ garments: raw["garments"] ?? [] });
}

export async function callScraperService(params: {
  serviceUrl: string;
  url: string;
}): Promise<string | null> {
  const response = await fetch(new URL("/scrape", params.serviceUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: params.url }),
  });

  if (!response.ok) return null;

  const body = await response.json() as { html?: unknown };
  return typeof body.html === "string" ? body.html : null;
}
