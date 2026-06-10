import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: projectRoot,
  experimental: {
    // Keep recently-visited dynamic routes (e.g. /wardrobe, /outfits) warm in the
    // client Router Cache for 30s so switching back and forth between tabs reuses
    // the already-rendered payload instead of re-running a server fetch each time.
    // Server actions call revalidatePath on every mutation, so a user's own edits
    // still invalidate the cache immediately — the 30s window only bounds staleness
    // for changes made elsewhere (other devices, cron jobs).
    staleTimes: {
      dynamic: 30,
      static: 180
    }
  }
};

export default nextConfig;
