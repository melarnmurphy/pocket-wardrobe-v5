import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

export class RateLimitError extends Error {
  constructor() {
    super("Too many attempts. Please try again later.");
    this.name = "RateLimitError";
  }
}

// Module-level singletons — survive across requests in the same function instance.
let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

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
  windowSeconds: number
): Promise<void> {
  const limiter = getLimiter(action, requests, windowSeconds);
  if (!limiter) return; // Upstash not configured — no-op in local dev

  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    "anonymous";

  const { success } = await limiter.limit(ip);
  if (!success) throw new RateLimitError();
}
