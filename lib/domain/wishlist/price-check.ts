import { promises as dns } from "node:dns";
import net from "node:net";

const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export interface FetchedPrice {
  priceCents: number;
  currency: string;
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd");
  }
  return false;
}

/**
 * source_url is a per-user-submitted string, so a cron fetching it
 * server-side is a real SSRF surface — refuse local/private targets before
 * ever calling fetch().
 */
async function assertSafeUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported URL scheme.");
  }
  if (url.hostname === "localhost") {
    throw new Error("Refusing to fetch a local address.");
  }
  const addresses = await dns.lookup(url.hostname, { all: true });
  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new Error("Refusing to fetch a private address.");
    }
  }
}

function parsePriceToCents(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function findOfferPrice(node: unknown, depth = 0): FetchedPrice | null {
  if (!node || typeof node !== "object" || depth > 4) return null;
  const obj = node as Record<string, unknown>;

  const offers = obj.offers;
  if (offers) {
    const offerList = Array.isArray(offers) ? offers : [offers];
    for (const offer of offerList) {
      if (offer && typeof offer === "object") {
        const offerObj = offer as Record<string, unknown>;
        const price = offerObj.price ?? offerObj.lowPrice;
        if (price !== undefined) {
          const cents = parsePriceToCents(String(price));
          if (cents !== null) {
            const currency = typeof offerObj.priceCurrency === "string" ? offerObj.priceCurrency : "AUD";
            return { priceCents: cents, currency };
          }
        }
      }
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = findOfferPrice(value, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function extractPriceFromHtml(html: string): FetchedPrice | null {
  const ldJsonBlocks = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  ];
  for (const match of ldJsonBlocks) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        const found = findOfferPrice(candidate);
        if (found) return found;
      }
    } catch {
      continue;
    }
  }

  const amountMatch = html.match(
    /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([\d.,]+)["']/i
  );
  const currencyMatch = html.match(
    /<meta[^>]+property=["']product:price:currency["'][^>]+content=["']([A-Z]{3})["']/i
  );
  if (amountMatch) {
    const cents = parsePriceToCents(amountMatch[1]);
    if (cents !== null) {
      return { priceCents: cents, currency: currencyMatch?.[1] ?? "AUD" };
    }
  }

  return null;
}

/**
 * Best-effort only: reads whichever of schema.org JSON-LD (Product/Offer)
 * or Open Graph product:price meta tags a page happens to expose. There is
 * no per-retailer integration — a page with neither returns null, which the
 * caller treats as "couldn't check this one," not an error.
 */
export async function fetchPriceFromUrl(sourceUrl: string): Promise<FetchedPrice | null> {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }

  try {
    await assertSafeUrl(url);
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; GarderobeWishlistBot/1.0)" }
    });
    if (!response.ok || !response.body) {
      html = response.ok ? await response.text() : "";
      if (!html) return null;
    } else {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received > MAX_RESPONSE_BYTES) {
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }
      html = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf-8");
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }

  return extractPriceFromHtml(html);
}
