import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", ".worktrees/**", ".claude/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: [
      { find: "@/app/account", replacement: path.resolve(__dirname, "app/(app)/account") },
      { find: "@/app/admin", replacement: path.resolve(__dirname, "app/(app)/admin") },
      { find: "@/app/auth", replacement: path.resolve(__dirname, "app/(app)/auth") },
      { find: "@/app/calendar", replacement: path.resolve(__dirname, "app/(app)/calendar") },
      { find: "@/app/local", replacement: path.resolve(__dirname, "app/(app)/local") },
      { find: "@/app/lookbook", replacement: path.resolve(__dirname, "app/(app)/lookbook") },
      { find: "@/app/onboarding", replacement: path.resolve(__dirname, "app/(app)/onboarding") },
      { find: "@/app/outfits", replacement: path.resolve(__dirname, "app/(app)/outfits") },
      { find: "@/app/style-rules", replacement: path.resolve(__dirname, "app/(app)/style-rules") },
      { find: "@/app/today", replacement: path.resolve(__dirname, "app/(app)/today") },
      { find: "@/app/trends", replacement: path.resolve(__dirname, "app/(app)/trends") },
      { find: "@/app/wardrobe", replacement: path.resolve(__dirname, "app/(app)/wardrobe") },
      { find: "@/app/wishlist", replacement: path.resolve(__dirname, "app/(app)/wishlist") },
      { find: "@", replacement: path.resolve(__dirname, ".") }
    ]
  },
});
