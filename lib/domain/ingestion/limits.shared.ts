/** Browser-safe upload limits and file classification. */
export const SUPPORTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;

export function classifyUploadFile(file: { type: string; size: number }): "ok" | "unsupported_format" | "too_large" {
  if (!SUPPORTED_IMAGE_MIME_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_MIME_TYPES)[number])) return "unsupported_format";
  if (file.size > MAX_UPLOAD_BYTES) return "too_large";
  return "ok";
}
