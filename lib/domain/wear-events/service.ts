import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { createWearEventSchema, wearEventSchema } from "@/lib/domain/wear-events";
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

  return recentWearEventSchema.parse(data);
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

  const firstImagePathByGarment = new Map<string, string>();
  const garmentImageRows: GarmentImageRow[] = images ?? [];
  for (const image of garmentImageRows) {
    if (!firstImagePathByGarment.has(image.garment_id)) {
      firstImagePathByGarment.set(image.garment_id, image.storage_path);
    }
  }

  const previewUrlsByPath = new Map<string, string | null>();
  const imagePaths = Array.from(firstImagePathByGarment.values());

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
        const path = firstImagePathByGarment.get(event.garment_id);
        return path ? previewUrlsByPath.get(path) ?? null : null;
      })()
    })
  );
}
