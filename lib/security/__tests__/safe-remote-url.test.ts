import { describe, expect, it, vi } from "vitest";

const lookup = vi.fn();

vi.mock("node:dns", () => ({
  promises: { lookup }
}));

describe("safe remote URL guard", () => {
  it("rejects localhost before DNS resolution", async () => {
    const { assertSafeRemoteUrl } = await import("@/lib/security/safe-remote-url");

    await expect(assertSafeRemoteUrl("http://localhost:8000/image.jpg")).rejects.toThrow(/private/i);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects a hostname resolving to a private address", async () => {
    lookup.mockResolvedValueOnce([{ address: "192.168.1.20", family: 4 }]);
    const { assertSafeRemoteUrl } = await import("@/lib/security/safe-remote-url");

    await expect(assertSafeRemoteUrl("https://shop.example/image.jpg")).rejects.toThrow(/private/i);
  });

  it("limits streamed response bodies", async () => {
    const { readResponseTextWithLimit } = await import("@/lib/security/safe-remote-url");
    const response = new Response("this is too long");

    await expect(readResponseTextWithLimit(response, 4)).rejects.toThrow(/too large/i);
  });
});
