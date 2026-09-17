import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { logger } from "@/lib/observability/logger";

export class RateLimitError extends Error {
  constructor() {
    super("Too many attempts. Please try again later.");
    this.name = "RateLimitError";
  }
}

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("The security check is temporarily unavailable. Please try again shortly.");
    this.name = "RateLimitUnavailableError";
  }
}

// Module-level singletons — survive across requests in the same function instance.
let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();
const OPTIONAL_CHECK_TIMEOUT_MS = 800;

function getRedis(): Redis | null {
  if (redis !== null) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function getLimiter(prefix: string, requests: number, windowSeconds: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const key = `${prefix}:${requests}:${windowSeconds}`;
  if (!limiters.has(key)) {
    limiters.set(
      key,
      new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
        prefix: `pw:rl:${prefix}`,
      })
    );
  }
  return limiters.get(key)!;
}

export async function checkRateLimit(
  action: string,
  requests: number,
  windowSeconds: number,
  options: { failClosed?: boolean } = {}
): Promise<void> {
  const limiter = getLimiter(action, requests, windowSeconds);
  if (!limiter) {
    if (options.failClosed && process.env.NODE_ENV === "production") {
      throw new RateLimitUnavailableError();
    }
    return;
  }

  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    "anonymous";

  let success: boolean;
  try {
    ({ success } = await Promise.race([
      limiter.limit(ip),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new RateLimitUnavailableError()), OPTIONAL_CHECK_TIMEOUT_MS);
      })
    ]));
  } catch (error) {
    // Upstash is configured but unreachable (wrong/stale credentials, outage). Fail open
    // rather than break every rate-limited action (sign-in, sign-up, etc.) on a dependency
    // that's meant to be a safety net, not a hard requirement.
    if (options.failClosed && process.env.NODE_ENV === "production") {
      throw new RateLimitUnavailableError();
    }
    logger.error("rate_limit_unavailable", error, { action });
    return;
  }
  if (!success) throw new RateLimitError();
}
