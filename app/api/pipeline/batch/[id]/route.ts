import { NextResponse, type NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { getPhotoBatch } from "@/lib/domain/ingestion/batch";

/** Polled by the batch progress screen (14b) so it can be closed and reopened. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const batch = await getPhotoBatch(id);

    if (!batch) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    return NextResponse.json(batch);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Unable to read the batch.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
