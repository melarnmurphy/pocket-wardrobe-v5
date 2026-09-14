import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { removeFailedPhotoBatchItem, retryFailedPhotoBatchItem } from "@/lib/domain/ingestion/batch";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { itemId?: string; action?: "retry" | "remove" };
    if (!body.itemId) return NextResponse.json({ error: "Failed photo is required." }, { status: 400 });
    if (body.action === "remove") await removeFailedPhotoBatchItem(id, body.itemId);
    else await retryFailedPhotoBatchItem(id, body.itemId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to retry photo." }, { status: 400 });
  }
}
