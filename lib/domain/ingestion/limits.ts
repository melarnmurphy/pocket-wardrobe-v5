/**
 * "Upload failed / unsupported file — HEIC, size caps, a dead product URL"
 * (MODALS.md §3). HEIC/HEIF decode inconsistently across browsers and the
 * pipeline service never learned to read them, so they are rejected before
 * upload rather than failing further down with an opaque storage error.
 */
export const SUPPORTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** 20MB — comfortably above a phone photo, well below what the pipeline chokes on. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function classifyUploadFile(file: {
  type: string;
  size: number;
}): "ok" | "unsupported_format" | "too_large" {
  if (!SUPPORTED_IMAGE_MIME_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_MIME_TYPES)[number])) {
    return "unsupported_format";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "too_large";
  }
  return "ok";
}
