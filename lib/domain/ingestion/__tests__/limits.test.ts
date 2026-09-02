import { describe, it, expect } from "vitest";
import { classifyUploadFile, MAX_UPLOAD_BYTES, SUPPORTED_IMAGE_MIME_TYPES } from "@/lib/domain/ingestion/limits";

describe("classifyUploadFile", () => {
  it("accepts a normal jpeg under the size cap", () => {
    expect(classifyUploadFile({ type: "image/jpeg", size: 1_000_000 })).toBe("ok");
  });

  it("rejects HEIC as an unsupported format", () => {
    expect(classifyUploadFile({ type: "image/heic", size: 1_000_000 })).toBe("unsupported_format");
  });

  it("rejects HEIF as an unsupported format", () => {
    expect(classifyUploadFile({ type: "image/heif", size: 1_000_000 })).toBe("unsupported_format");
  });

  it("rejects a file over the size cap even if the format is supported", () => {
    expect(classifyUploadFile({ type: "image/png", size: MAX_UPLOAD_BYTES + 1 })).toBe("too_large");
  });

  it("exports the supported list with jpeg, png and webp", () => {
    expect(SUPPORTED_IMAGE_MIME_TYPES).toContain("image/jpeg");
    expect(SUPPORTED_IMAGE_MIME_TYPES).toContain("image/png");
    expect(SUPPORTED_IMAGE_MIME_TYPES).toContain("image/webp");
  });
});
