import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { createWearEventSchema, wearEventSchema } from "@/lib/domain/wear-events";
import { getFeatureImagePath } from "@/lib/domain/wardrobe/service";
import type { Database, TablesInsert } from "@/types/database";

type WearEventRow = Database["public"]["Tables"]["wear_events"]["Row"];
type GarmentRow = Database["public"]["Tables"]["garments"]["Row"];
type GarmentImageRow = Database["public"]["Tables"]["garment_images"]["Row"];
type WearEventInsert = TablesInsert<"wear_events">;
const timestampSchema = z.string().min(1);

const recentWearEventSchema = wearEventSchema.extend({
  id: z.string().uuid(),
  worn_at: timestampSchema,
  created_at: timestampSchema
});

const recentWearEventListSchema = recentWearEventSchema.extend({
  garment_title: z.string().nullable().optional(),
  garment_brand: z.string().nullable().optional(),
  garment_category: z.string().nullable().optional(),
  garment_preview_url: z.string().nullable().optional()
});

export type RecentWearEvent = z.infer<typeof recentWearEventListSchema>;

const updateWearEventSchema = z.object({
  wornAt: z.string().min(1).optional(),
  occasion: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});

/**
 * Every write here is a wear_events row and nothing else. wear_count,
 * last_worn_at and cost_per_wear are recomputed authoritatively by the
 * sync_garment_wear_stats_from_events() trigger (schema.sql) from a
 * COUNT(*) over wear_events — never written directly — so that "wear
 * counts, cost per wear, least-worn sort and the calendar all agree,
 * because they all read wear_events" (BUILD_ORDER phase 5).
 */
export async function logWearEvent(input: z.input<typeof createWearEventSchema>) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const payload: WearEventInsert = wearEventSchema.parse({
    ...input,
    user_id: user.id
  });

  const { data, error } = await supabase
    .from("wear_events")
    .insert(payload as never)
    .select("id,user_id,garment_id,worn_at,occasion,notes,outfit_id,created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return recentWearEventSchema.parse(data);
}

/**
 * "Quick add N wears" — still one wear_events row per wear (never a direct
 * wear_count write), backdated one day at a time from wornAt so multiple
 * wears logged at once don't collide with "one wear per piece per day".
 */
export async function incrementWearCount(params: {
  garmentId: string;
  wearsToAdd: number;
  wornAt?: string | null;
}) {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const garmentId = z.string().uuid().parse(params.garmentId);
  const wearsToAdd = z.number().int().positive().parse(params.wearsToAdd);
  const anchor = params.wornAt?.trim() ? new Date(params.wornAt) : new Date();
  const anchorTime = Number.isNaN(anchor.getTime()) ? new Date() : anchor;

  const rows: WearEventInsert[] = Array.from({ length: wearsToAdd }, (_, index) => {
    const date = new Date(anchorTime);
    date.setUTCDate(date.getUTCDate() - index);
    return wearEventSchema.parse({
      garment_id: garmentId,
      user_id: user.id,
      worn_at: date.toISOString()
    });
  });

  const { error: insertError } = await supabase.from("wear_events").insert(rows as never);

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { data: garment, error: garmentError } = await supabase
    .from("garments")
    .select("wear_count,last_worn_at,cost_per_wear")
    .eq("id", garmentId)
    .eq("user_id", user.id)
    .single();

  if (garmentError || !garment) {
    throw new Error(garmentError?.message || "Garment not found.");
  }

  return garment as Pick<GarmentRow, "wear_count" | "last_worn_at" | "cost_per_wear">;
}

/** 18a / w6b — "remove or correct a logged wear". */
export async function updateWearEvent(params: {
  wearEventId: string;
  wornAt?: string;
  occasion?: string | null;
  notes?: string | null;
}) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(params.wearEventId);
  const values = updateWearEventSchema.parse({
    wornAt: params.wornAt,
    occasion: params.occasion,
    notes: params.notes
  });

  const patch: Partial<WearEventInsert> = {};
  if (values.wornAt !== undefined) patch.worn_at = values.wornAt;
  if (values.occasion !== undefined) patch.occasion = values.occasion;
  if (values.notes !== undefined) patch.notes = values.notes;

  const { error } = await supabase
    .from("wear_events")
    .update(patch as never)
    .eq("id", parsedId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

/** 18a / w6b — the delete half of "remove or correct a logged wear". */
export async function deleteWearEvent(wearEventId: string) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(wearEventId);

  const { error } = await supabase
    .from("wear_events")
    .delete()
    .eq("id", parsedId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

/** 11b / w3g — "what you wore, and when" for one look. */
export async function listWearEventsForOutfit(outfitId: string): Promise<string[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedOutfitId = z.string().uuid().parse(outfitId);

  const { data, error } = await supabase
    .from("wear_events")
    .select("worn_at")
    .eq("user_id", user.id)
    .eq("outfit_id", parsedOutfitId)
    .order("worn_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{ worn_at: string }>).map((row) => row.worn_at);
}

export type WearDayEntry = {
  garmentId: string;
  title: string | null;
  category: string;
  previewUrl: string | null;
};

/** 9d / w3h — the calendar reads wear_events, grouped by the local date it was worn. */
export async function listWearEventsByDate(limit = 500): Promise<Map<string, WearDayEntry[]>> {
  const events = await listRecentWearEvents(limit);
  const byDate = new Map<string, WearDayEntry[]>();

  for (const event of events) {
    const dateKey = event.worn_at.slice(0, 10);
    const entry: WearDayEntry = {
      garmentId: event.garment_id,
      title: event.garment_title ?? null,
      category: event.garment_category ?? "piece",
      previewUrl: event.garment_preview_url ?? null
    };
    byDate.set(dateKey, [...(byDate.get(dateKey) ?? []), entry]);
  }

  return byDate;
}

export async function listRecentWearEvents(limit = 10): Promise<RecentWearEvent[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("wear_events")
    .select("id,user_id,garment_id,worn_at,occasion,notes,outfit_id,created_at")
    .eq("user_id", user.id)
    .order("worn_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const parsedEvents = z
    .array(recentWearEventSchema)
    .parse((data ?? []) satisfies WearEventRow[]);

  if (!parsedEvents.length) {
    return [];
  }

  const garmentIds = Array.from(new Set(parsedEvents.map((event) => event.garment_id)));

  const { data: garments, error: garmentsError } = await supabase
    .from("garments")
    .select("id,title,brand,category")
    .in("id", garmentIds);

  if (garmentsError) {
    throw new Error(garmentsError.message);
  }

  const { data: images, error: imagesError } = await supabase
    .from("garment_images")
    .select("id,garment_id,image_type,storage_path,width,height,created_at")
    .in("garment_id", garmentIds)
    .order("created_at", { ascending: false });

  if (imagesError) {
    throw new Error(imagesError.message);
  }

  const garmentById = new Map<
    string,
    Pick<GarmentRow, "id" | "title" | "brand" | "category">
  >();
  const garmentRows: Pick<GarmentRow, "id" | "title" | "brand" | "category">[] =
    garments ?? [];
  for (const garment of garmentRows) {
    garmentById.set(garment.id, garment);
  }

  const featureImagePathByGarment = new Map<string, string>();
  const garmentImageRows: GarmentImageRow[] = images ?? [];
  const imagesByGarment = new Map<string, GarmentImageRow[]>();
  for (const image of garmentImageRows) {
    const existing = imagesByGarment.get(image.garment_id) ?? [];
    existing.push(image);
    imagesByGarment.set(image.garment_id, existing);
  }

  for (const [garmentId, garmentImages] of imagesByGarment.entries()) {
    const featurePath = getFeatureImagePath(garmentImages as any);
    if (featurePath) {
      featureImagePathByGarment.set(garmentId, featurePath);
    }
  }

  const previewUrlsByPath = new Map<string, string | null>();
  const imagePaths = Array.from(featureImagePathByGarment.values());

  if (imagePaths.length) {
    const { data: signedUrls, error: signedUrlsError } = await supabase.storage
      .from("garment-originals")
      .createSignedUrls(imagePaths, 60 * 60);

    if (signedUrlsError) {
      throw new Error(signedUrlsError.message);
    }

    for (const signedUrl of signedUrls) {
      if (signedUrl.path) {
        previewUrlsByPath.set(signedUrl.path, signedUrl.signedUrl ?? null);
      }
    }
  }

  return parsedEvents.map((event) =>
    recentWearEventListSchema.parse({
      ...event,
      garment_title: garmentById.get(event.garment_id)?.title ?? null,
      garment_brand: garmentById.get(event.garment_id)?.brand ?? null,
      garment_category: garmentById.get(event.garment_id)?.category ?? null,
      garment_preview_url: (() => {
        const path = featureImagePathByGarment.get(event.garment_id);
        return path ? previewUrlsByPath.get(path) ?? null : null;
      })()
    })
  );
}
