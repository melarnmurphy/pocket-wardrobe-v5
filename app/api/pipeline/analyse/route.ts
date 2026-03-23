import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequiredUser, AuthenticationError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { callPipelineService } from "@/lib/domain/ingestion/client";
import { createDraftsFromPipelineResult } from "@/lib/domain/ingestion/service";
import type { Tables } from "@/types/database";

const requestSchema = z.object({
  sourceId: z.string().uuid(),
  threshold: z.number().min(0).max(1).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getRequiredUser();
    const supabase = await createClient();

    const body = await request.json() as unknown;
    const { sourceId, threshold } = requestSchema.parse(body);

    // Verify source belongs to user
    const { data: source, error: sourceError } = await supabase
      .from("garment_sources")
      .select("id, storage_path")
      .eq("id", sourceId)
      .eq("user_id", user.id)
      .single() as unknown as {
        data: Pick<Tables<"garment_sources">, "id" | "storage_path"> | null;
        error: { message: string } | null;
      };

    if (sourceError || !source) {
      return NextResponse.json({ error: "Source not found." }, { status: 404 });
    }

    if (!source.storage_path) {
      return NextResponse.json(
        { error: "Source has no stored image." },
        { status: 422 }
      );
    }

    // Generate a signed URL (valid 5 minutes — enough for pipeline processing)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("garment-originals")
      .createSignedUrl(source.storage_path, 5 * 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate image URL." },
        { status: 500 }
      );
    }

    const env = getServerEnv();

    const pipelineResult = await callPipelineService({
      serviceUrl: env.PIPELINE_SERVICE_URL,
      imageUrl: signedUrlData.signedUrl,
      threshold,
    });

    const draftIds = await createDraftsFromPipelineResult({
      sourceId,
      result: pipelineResult,
    });

    return NextResponse.json({
      draftIds,
      garmentCount: pipelineResult.garments.length,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
