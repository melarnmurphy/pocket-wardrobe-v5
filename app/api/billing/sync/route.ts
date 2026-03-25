import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getServerEnv } from "@/lib/env";
import { syncUserEntitlementsFromBillingEvent } from "@/lib/domain/billing/service";

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

    if (!providedSecret || providedSecret !== env.BILLING_SYNC_SECRET) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = await request.json();
    const entitlements = await syncUserEntitlementsFromBillingEvent(payload);

    return NextResponse.json({ entitlements }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid billing sync payload." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Billing sync failed." },
      { status: 500 }
    );
  }
}
