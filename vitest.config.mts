import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const projectRoot = process.cwd();

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    // Several service tests intentionally mock the same modules differently;
    // keeping files in one worker prevents cross-file mock leakage.
    fileParallelism: false,
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**", ".worktrees/**", ".claude/**"],
    setupFiles: ["./vitest.setup.ts"]
  },
  resolve: {
    alias: [
      { find: "@/app/account", replacement: path.resolve(projectRoot, "app/(app)/account") },
      { find: "@/app/admin", replacement: path.resolve(projectRoot, "app/(app)/admin") },
      { find: "@/app/auth", replacement: path.resolve(projectRoot, "app/(app)/auth") },
      { find: "@/app/calendar", replacement: path.resolve(projectRoot, "app/(app)/calendar") },
      { find: "@/app/local", replacement: path.resolve(projectRoot, "app/(app)/local") },
      { find: "@/app/lookbook", replacement: path.resolve(projectRoot, "app/(app)/lookbook") },
      { find: "@/app/onboarding", replacement: path.resolve(projectRoot, "app/(app)/onboarding") },
      { find: "@/app/outfits", replacement: path.resolve(projectRoot, "app/(app)/outfits") },
      { find: "@/app/style-rules", replacement: path.resolve(projectRoot, "app/(app)/style-rules") },
      { find: "@/app/today", replacement: path.resolve(projectRoot, "app/(app)/today") },
      { find: "@/app/trends", replacement: path.resolve(projectRoot, "app/(app)/trends") },
      { find: "@/app/wardrobe", replacement: path.resolve(projectRoot, "app/(app)/wardrobe") },
      { find: "@/app/wishlist", replacement: path.resolve(projectRoot, "app/(app)/wishlist") },
      { find: "@", replacement: projectRoot }
    ]
  }
});
