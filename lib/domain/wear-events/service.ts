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

  const { data: garment, error: garmentError } = await supabase
    .from("garments")
    .select("id,wear_count,purchase_price,last_worn_at")
    .eq("id", payload.garment_id)
    .eq("user_id", user.id)
    .single();

  if (garmentError || !garment) {
    throw new Error(garmentError?.message || "Garment not found.");
  }

  const parsedGarment = garment as Pick<
    GarmentRow,
    "id" | "wear_count" | "purchase_price" | "last_worn_at"
  >;
  const wornAt = payload.worn_at ?? new Date().toISOString();
  const nextWearCount = parsedGarment.wear_count + 1;
  const nextLastWornAt = latestTimestamp(parsedGarment.last_worn_at, wornAt);
  const nextCostPerWear =
    parsedGarment.purchase_price != null
      ? parsedGarment.purchase_price / Math.max(nextWearCount, 1)
      : null;

  const { error: updateGarmentError } = await supabase
    .from("garments")
    .update({
      wear_count: nextWearCount,
      last_worn_at: nextLastWornAt,
      cost_per_wear: nextCostPerWear
    } as never)
    .eq("id", payload.garment_id)
    .eq("user_id", user.id);

  if (updateGarmentError) {
    throw new Error(updateGarmentError.message);
  }

  return recentWearEventSchema.parse(data);
}

export async function incrementWearCount(params: {
  garmentId: string;
  wearsToAdd: number;
  wornAt?: string | null;
}) {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const garmentId = z.string().uuid().parse(params.garmentId);
  const wearsToAdd = z.number().int().positive().parse(params.wearsToAdd);

  const { data: garment, error: garmentError } = await supabase
    .from("garments")
    .select("id,wear_count,purchase_price,last_worn_at")
    .eq("id", garmentId)
    .eq("user_id", user.id)
    .single();

  if (garmentError || !garment) {
    throw new Error(garmentError?.message || "Garment not found.");
  }

  const parsedGarment = garment as Pick<
    GarmentRow,
    "id" | "wear_count" | "purchase_price" | "last_worn_at"
  >;
  const effectiveWornAt = params.wornAt?.trim() ? params.wornAt : new Date().toISOString();
  const nextWearCount = parsedGarment.wear_count + wearsToAdd;
  const nextLastWornAt = latestTimestamp(parsedGarment.last_worn_at, effectiveWornAt);
  const nextCostPerWear =
    parsedGarment.purchase_price != null
      ? parsedGarment.purchase_price / Math.max(nextWearCount, 1)
      : null;

  const { error: updateGarmentError } = await supabase
    .from("garments")
    .update({
      wear_count: nextWearCount,
      last_worn_at: nextLastWornAt,
      cost_per_wear: nextCostPerWear
    } as never)
    .eq("id", garmentId)
    .eq("user_id", user.id);

  if (updateGarmentError) {
    throw new Error(updateGarmentError.message);
  }

  return {
    wear_count: nextWearCount,
    last_worn_at: nextLastWornAt,
    cost_per_wear: nextCostPerWear
  };
}

function latestTimestamp(current: string | null, candidate: string) {
  const currentDate = current ? new Date(current) : null;
  const candidateDate = new Date(candidate);

  if (Number.isNaN(candidateDate.getTime())) {
    return current ?? candidate;
  }

  if (!currentDate || Number.isNaN(currentDate.getTime())) {
    return candidateDate.toISOString();
  }

  return candidateDate > currentDate ? candidateDate.toISOString() : currentDate.toISOString();
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
