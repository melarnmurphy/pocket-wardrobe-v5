/** Server-side image validation. Browser-safe constants live in limits.shared.ts. */
import { MAX_IMAGE_PIXELS, classifyUploadFile, SUPPORTED_IMAGE_MIME_TYPES, MAX_UPLOAD_BYTES } from "./limits.shared";

export { MAX_IMAGE_PIXELS, classifyUploadFile, SUPPORTED_IMAGE_MIME_TYPES, MAX_UPLOAD_BYTES } from "./limits.shared";

export async function validateImageUpload(file: File): Promise<{
  buffer: Buffer;
  contentType: (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];
  width: number;
  height: number;
}> {
  const check = classifyUploadFile(file);
  if (check === "unsupported_format") throw new Error("That image format is not supported. Use JPEG, PNG, or WEBP.");
  if (check === "too_large") throw new Error("That image is too large. Images over 20MB cannot be uploaded.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = buffer.length > 12 && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";

  if (!isJpeg && !isPng && !isWebp) throw new Error("That file is not a readable image. Try a JPEG, PNG, or WEBP photo.");

  const sharp = (await import("sharp")).default;
  const metadata = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height || width * height > MAX_IMAGE_PIXELS) {
    throw new Error("That image is too large to process. Try a smaller photo.");
  }

  const contentType = isJpeg ? "image/jpeg" : isPng ? "image/png" : "image/webp";
  return { buffer, contentType, width, height };
}
