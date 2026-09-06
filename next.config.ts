import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: projectRoot,
  // lib/domain/billing/apple.ts reads Apple's root CA cert via a dynamic
  // path.join(process.cwd(), ...) call, which Vercel's automatic file
  // tracing can't always resolve statically — this guarantees the binary
  // .cer file actually ships inside the serverless function bundle.
  outputFileTracingIncludes: {
    "/api/mobile/billing/verify-purchase": ["./lib/domain/billing/apple-certs/**"]
  },
  experimental: {
    // Keep recently-visited dynamic routes (e.g. /wardrobe, /outfits) warm in the
    // client Router Cache so switching tabs reuses the already-rendered payload
    // instead of re-running a server fetch each time.
    // Server actions call revalidatePath on every mutation, so a user's own edits
    // still invalidate the cache immediately — staleTimes only bound staleness
    // for changes made elsewhere (other devices, cron jobs).
    staleTimes: {
      dynamic: 60,
      static: 180
    }
  }
};

export default nextConfig;
