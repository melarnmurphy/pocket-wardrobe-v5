import { describe, it, expect, vi, beforeEach } from "vitest";

const imagesEdit = vi.fn();
vi.mock("openai", () => {
  class FakeOpenAI {
    images = { edit: imagesEdit };
  }
  return {
    default: FakeOpenAI,
    toFile: vi.fn(async (bytes: unknown, name: string) => ({ bytes, name }))
  };
});

vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: vi.fn(() => ({ OPENAI_API_KEY: "sk-test" }))
}));

function makeReferenceFile(name = "ref.jpg") {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

describe("generateAvatarFromReferencePhotos", () => {
  const assertPaidPlanAccess = vi.fn(async () => ({}));
  const checkRateLimit = vi.fn(async () => {});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    assertPaidPlanAccess.mockImplementation(async () => ({}));
    checkRateLimit.mockImplementation(async () => {});
    vi.doMock("@/lib/domain/entitlements/service", () => ({
      assertPaidPlanAccess,
      FeatureAccessError: class FeatureAccessError extends Error {
        statusCode = 403;
      }
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      checkRateLimit,
      RateLimitError: class RateLimitError extends Error {
        constructor() {
          super("Too many attempts. Please try again later.");
        }
      }
    }));
  });

  it("refuses to call OpenAI at all when the user isn't on a paid plan", async () => {
    const { FeatureAccessError } = await import("@/lib/domain/entitlements/service");
    assertPaidPlanAccess.mockRejectedValue(
      new FeatureAccessError("Digital twin avatar generation is available on paid plans.")
    );

    const { generateAvatarFromReferencePhotos } = await import("@/lib/domain/avatar/service");

    await expect(
      generateAvatarFromReferencePhotos([makeReferenceFile(), makeReferenceFile()])
    ).rejects.toThrow(/paid plan/i);

    expect(imagesEdit).not.toHaveBeenCalled();
  });

  it("refuses to call OpenAI when the rate limit is exceeded, even for a paid user", async () => {
    const { RateLimitError } = await import("@/lib/rate-limit");
    checkRateLimit.mockRejectedValue(new RateLimitError());

    const { generateAvatarFromReferencePhotos } = await import("@/lib/domain/avatar/service");

    await expect(
      generateAvatarFromReferencePhotos([makeReferenceFile(), makeReferenceFile()])
    ).rejects.toThrow(/too many/i);

    expect(imagesEdit).not.toHaveBeenCalled();
  });

  it("checks entitlement and rate limit before ever calling images.edit, and lets a paid user under the limit reach the OpenAI call", async () => {
    imagesEdit.mockResolvedValue({ data: [{ b64_json: Buffer.from("fake-png").toString("base64") }] });

    // The downstream Supabase save isn't this test's concern — only that the
    // gate and rate limit both run, in order, before the expensive call.
    // Whatever happens after images.edit is free to fail in this stub setup.
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => {
        throw new Error("supabase not stubbed for this test — save step intentionally unexercised");
      })
    }));

    const { generateAvatarFromReferencePhotos } = await import("@/lib/domain/avatar/service");
    await generateAvatarFromReferencePhotos([makeReferenceFile(), makeReferenceFile()]).catch(() => {});

    expect(assertPaidPlanAccess).toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledWith("avatar-generate", expect.any(Number), expect.any(Number));
    expect(imagesEdit).toHaveBeenCalled();

    // The gate and the limit must both run before the expensive call, not after.
    const assertOrder = assertPaidPlanAccess.mock.invocationCallOrder[0];
    const limitOrder = checkRateLimit.mock.invocationCallOrder[0];
    const editOrder = imagesEdit.mock.invocationCallOrder[0];
    expect(assertOrder).toBeLessThan(editOrder);
    expect(limitOrder).toBeLessThan(editOrder);
  });
});
