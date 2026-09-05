import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import {
  logWearEvent,
  listRecentWearEvents,
  uploadWearEventPhoto
} from "@/lib/domain/wear-events/service";

export const dynamic = "force-dynamic";

const logWearEventsInputSchema = z.object({
  garment_ids: z.array(z.string().uuid()).min(1).max(20),
  worn_at: z.string().trim().min(1).optional(),
  occasion: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});

// The Diary calendar reads this to fill its month grid — one row per
// garment per wear, which the client groups into a per-day entry itself
// (a day can have several pieces logged in one submission).
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "500");
    const events = await listRecentWearEvents(limit, { supabase, userId: user.id });
    return NextResponse.json({ events });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load wear history" },
      { status: 500 }
    );
  }
}

// The Diary's "what you wore" log has no single-outfit concept the way the
// Planner does (it's a multi-piece pick, not necessarily a saved outfit), so
// this logs one wear_events row per selected garment rather than requiring
// an outfit_id — garments.wear_count/last_worn_at/cost_per_wear all update
// via the existing sync_garment_wear_stats_from_events() trigger regardless.
// Multipart carries the same fields as the JSON body plus one optional
// "photo" file (LogOutfitSheet's drop zone) — a single mirror selfie
// shared across every piece logged in this submission, matching the
// existing "one wear_events row per garment, same occasion/notes" shape.
const logWearEventsMultipartFieldsSchema = z.object({
  garment_ids: z.array(z.string().uuid()).min(1).max(20),
  worn_at: z.string().trim().min(1).optional(),
  occasion: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const ctx = { supabase, userId: user.id };
    const contentType = request.headers.get("content-type") ?? "";

    let fields: z.infer<typeof logWearEventsMultipartFieldsSchema>;
    let photoFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const rawGarmentIds = formData.get("garment_ids");
      let garmentIds: unknown;
      try {
        garmentIds = typeof rawGarmentIds === "string" ? JSON.parse(rawGarmentIds) : rawGarmentIds;
      } catch {
        return NextResponse.json({ error: "garment_ids must be a JSON array." }, { status: 400 });
      }

      const parsedFields = logWearEventsMultipartFieldsSchema.safeParse({
        garment_ids: garmentIds,
        worn_at: formData.get("worn_at") ?? undefined,
        occasion: formData.get("occasion") ?? undefined,
        notes: formData.get("notes") ?? undefined
      });
      if (!parsedFields.success) {
        return NextResponse.json({ error: parsedFields.error.message }, { status: 400 });
      }
      fields = parsedFields.data;

      const rawPhoto = formData.get("photo");
      if (rawPhoto instanceof File && rawPhoto.size > 0) {
        photoFile = rawPhoto;
      }
    } else {
      const rawInput = await request.json();
      const parsed = logWearEventsInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 });
      }
      fields = parsed.data;
    }

    const photoStoragePath = photoFile ? await uploadWearEventPhoto({ file: photoFile }, ctx) : null;

    const logged = await Promise.all(
      fields.garment_ids.map((garment_id) =>
        logWearEvent(
          {
            garment_id,
            worn_at: fields.worn_at,
            occasion: fields.occasion,
            notes: fields.notes,
            photo_storage_path: photoStoragePath
          },
          ctx
        )
      )
    );

    return NextResponse.json({ logged: logged.length });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to log wear" },
      { status: 500 }
    );
  }
}
