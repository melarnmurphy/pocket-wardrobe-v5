import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import {
  createForwardedEmailSourceAndDrafts,
  parseForwardingRecipient
} from "@/lib/domain/ingestion/inbound-email";

/**
 * Inbound-email webhook shape for 13a/15b's forwarding address. No inbound
 * mail provider is connected yet (see docs/design/design_handoff_garderobe/
 * BUILD_ORDER.md phase 4) — verifying a shared secret and normalising the
 * payload is provider-agnostic on purpose, so wiring in Postmark/Mailgun/
 * SendGrid inbound-parse later is a thin adapter in front of this route,
 * not a rewrite of it.
 *
 * "Nothing enters the wardrobe from a receipt without an explicit accept" —
 * this only creates pending garment_drafts; a human still has to review
 * and accept each line in /wardrobe/review.
 */
const inboundEmailSchema = z.object({
  to: z.string().min(1).max(320),
  from: z.string().min(1).max(320),
  subject: z.string().max(500).default(""),
  text: z.string().max(100_000).default("")
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const env = getServerEnv();

  if (!env.RECEIPTS_INBOUND_SECRET) {
    return NextResponse.json(
      { error: "The inbound-receipts webhook is not configured." },
      { status: 503 }
    );
  }

  const providedSecret = request.headers.get("x-garderobe-receipts-secret");

  const supplied = Buffer.from(providedSecret ?? "");
  const expected = Buffer.from(env.RECEIPTS_INBOUND_SECRET);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 128 * 1024) {
    return NextResponse.json({ error: "Inbound email payload is too large." }, { status: 413 });
  }

  try {
    const body = (await request.json()) as unknown;
    const payload = inboundEmailSchema.parse(body);

    const userId = parseForwardingRecipient(payload.to);
    if (!userId) {
      // Not a recognised forwarding address — drop it, not an error the
      // sending provider should retry.
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    const { sourceId, draftIds } = await createForwardedEmailSourceAndDrafts({
      userId,
      fromAddress: payload.from,
      subject: payload.subject,
      text: payload.text
    });

    return NextResponse.json({ sourceId, draftCount: draftIds.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid inbound email payload." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unable to process the email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
