import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getServerEnv } from "@/lib/env";
import { syncUserEntitlementsFromBillingEvent } from "@/lib/domain/billing/service";
import { timingSafeEqual } from "node:crypto";

export async function POST(request: NextRequest) {
  try {
    const env = getServerEnv();

    if (!env.BILLING_SYNC_SECRET) {
      return NextResponse.json(
        { error: "Billing sync is not configured." },
        { status: 503 }
      );
    }

    const providedSecret = request.headers.get("x-pocketwardrobe-sync-secret");

    const supplied = Buffer.from(providedSecret ?? "");
    const expected = Buffer.from(env.BILLING_SYNC_SECRET);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 64 * 1024) {
      return NextResponse.json({ error: "Billing sync payload is too large." }, { status: 413 });
    }

    const payload = await request.json();
    const entitlements = await syncUserEntitlementsFromBillingEvent(payload);

    return NextResponse.json({ entitlements }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid billing sync payload." }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Billing sync is temporarily unavailable. Please retry." },
      { status: 500 }
    );
  }
}
