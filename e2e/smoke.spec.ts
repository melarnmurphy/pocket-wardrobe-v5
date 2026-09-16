import { test, expect } from "@playwright/test";

test("marketing home loads with a clear entry point", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Pocket Wardrobe|Garderobe/i);
  await expect(page.getByRole("link", { name: /sign in|get started|try/i }).first()).toBeVisible();
});

test("sign-in page exposes an understandable authentication form", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByPlaceholder("you@example.com").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in|continue/i })).toBeVisible();
});

test("protected wardrobe entry does not expose private data to signed-out users", async ({ page }) => {
  await page.goto("/wardrobe");
  await expect(page.getByRole("link", { name: /^sign in$/i }).first()).toBeVisible();
  await expect(page.getByText("authentication required", { exact: false })).toBeVisible();
});

test("signed-out users cannot enqueue private photo processing", async ({ request }) => {
  const response = await request.post("/api/pipeline/batch", {
    multipart: { photos: { name: "coat.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not-an-image") } }
  });

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized." });
});
