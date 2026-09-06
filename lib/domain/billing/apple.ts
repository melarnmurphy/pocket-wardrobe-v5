import { readFileSync } from "node:fs";
import path from "node:path";
import { SignedDataVerifier, Environment } from "@apple/app-store-server-library";
import type { JWSTransactionDecodedPayload } from "@apple/app-store-server-library";

// The iOS app's real bundle id (ios/PocketWardrobev5/PocketWardrobev5.xcodeproj/
// project.pbxproj's PRODUCT_BUNDLE_IDENTIFIER) — Apple's JWS verification
// rejects a transaction whose bundleId doesn't match this.
const BUNDLE_ID = "com.melandwes.PocketWardrobev5";

// Apple's public root CA (fetched from https://www.apple.com/certificateauthority/,
// the standard, publicly documented source every App Store Server Library
// integration uses — same certificate Apple's own sample code references).
// This is enough to verify a transaction's signature entirely offline: no
// App Store Connect API key is needed for this, unlike calls to the App
// Store Server API itself (querying transaction history, sending refunds,
// etc.), which do require one and aren't used here.
const APPLE_ROOT_CA = readFileSync(path.join(process.cwd(), "lib/domain/billing/apple-certs/AppleRootCA-G3.cer"));

function buildVerifier(environment: Environment): SignedDataVerifier {
  return new SignedDataVerifier([APPLE_ROOT_CA], true, environment, BUNDLE_ID);
}

/**
 * Verifies a StoreKit 2 transaction's JWS signature and decodes it. A real
 * device transaction could be either environment (a TestFlight/sandbox
 * tester's purchase, or a real production purchase) and nothing in the
 * request tells you which up front, so this tries Production first and
 * falls back to Sandbox — the pattern Apple's own sample code uses for
 * exactly this ambiguity.
 */
export async function verifyAppleTransaction(signedTransaction: string): Promise<JWSTransactionDecodedPayload> {
  try {
    return await buildVerifier(Environment.PRODUCTION).verifyAndDecodeTransaction(signedTransaction);
  } catch (productionError) {
    try {
      return await buildVerifier(Environment.SANDBOX).verifyAndDecodeTransaction(signedTransaction);
    } catch {
      throw productionError;
    }
  }
}

export function isAppleTransactionActive(decoded: JWSTransactionDecodedPayload): boolean {
  if (decoded.revocationDate) return false;
  if (decoded.expiresDate && decoded.expiresDate < Date.now()) return false;
  return true;
}
