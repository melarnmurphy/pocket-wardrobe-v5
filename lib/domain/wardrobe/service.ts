import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { createGarmentSchema, garmentSchema } from "@/lib/domain/wardrobe";
import {
  getCanonicalWardrobeColour,
  type WardrobeColourFamily
} from "@/lib/domain/wardrobe/colours";
import { garment3dAssetSchema } from "@/lib/domain/avatar";
import {
  analyseImageColours,
  buildFeatureDerivative
} from "@/lib/domain/wardrobe/image-analysis";
import type { Database, TablesInsert } from "@/types/database";

type Json = Database["public"]["Tables"]["garments"]["Row"]["extraction_metadata_json"];
type GarmentRow = Database["public"]["Tables"]["garments"]["Row"];
type GarmentListRow = Pick<
  GarmentRow,
  | "id"
  | "user_id"
  | "title"
  | "description"
  | "brand"
  | "category"
  | "subcategory"
  | "pattern"
  | "material"
  | "size"
  | "fit"
  | "formality_level"
  | "seasonality"
  | "wardrobe_status"
  | "purchase_price"
  | "purchase_currency"
  | "purchase_date"
  | "retailer"
  | "favourite_score"
  | "wear_count"
  | "last_worn_at"
  | "cost_per_wear"
  | "extraction_metadata_json"
  | "created_at"
  | "updated_at"
>;
type GarmentInsert = TablesInsert<"garments">;
type ColourRow = Database["public"]["Tables"]["colours"]["Row"];
type GarmentColourRow = Database["public"]["Tables"]["garment_colours"]["Row"];
type GarmentColourInsert = TablesInsert<"garment_colours">;
type GarmentImageRow = Database["public"]["Tables"]["garment_images"]["Row"];
type GarmentImageInsert = TablesInsert<"garment_images">;
type Garment3dAssetRow = Database["public"]["Tables"]["garment_3d_assets"]["Row"];
type Garment3dAssetInsert = TablesInsert<"garment_3d_assets">;
type GarmentSourceInsert = TablesInsert<"garment_sources">;
type WearEventRow = Database["public"]["Tables"]["wear_events"]["Row"];
type GarmentFavouriteLookupRow = Pick<GarmentRow, "id" | "favourite_score">;

const PRODUCT_IMAGE_FETCH_TIMEOUT_MS = 2500;

const timestampSchema = z.string().min(1);

const garmentListItemSchema = garmentSchema.extend({
  wear_count: z.number().int().nonnegative().default(0),
  favourite_score: z.coerce.number().nullable().optional(),
  cost_per_wear: z.coerce.number().nullable().optional(),
  last_worn_at: timestampSchema.nullable().optional(),
  primary_colour_family: z.string().nullable().optional(),
  primary_colour_hex: z.string().nullable().optional(),
  created_at: timestampSchema,
  updated_at: timestampSchema
});

const garmentImageSchema = z.object({
  id: z.string().uuid(),
  garment_id: z.string().uuid(),
  image_type: z.enum(["original", "cutout", "cropped", "thumbnail"]),
  storage_path: z.string().min(1),
  width: z.coerce.number().int().nullable().optional(),
  height: z.coerce.number().int().nullable().optional(),
  created_at: timestampSchema,
  preview_url: z.string().nullable().optional()
});

const garmentSourceSchema = z.object({
  id: z.string().uuid()
});

const garment3dAssetRowSchema = garment3dAssetSchema.extend({
  id: z.string().uuid(),
  garment_id: z.string().uuid(),
  created_at: timestampSchema,
  updated_at: timestampSchema
});

const garmentFavouriteLookupSchema = z.object({
  id: z.string().uuid(),
  favourite_score: z.coerce.number().nullable().optional()
});

const colourSchema = z.object({
  id: z.string().uuid(),
  family: z.string().min(1),
  hex: z.string().min(1)
});

const garmentColourSchema = z.object({
  id: z.string().uuid(),
  garment_id: z.string().uuid(),
  colour_id: z.string().uuid(),
  dominance: z.coerce.number(),
  is_primary: z.boolean(),
  created_at: timestampSchema
});

const garmentRecentWearSchema = z.object({
  id: z.string().uuid(),
  garment_id: z.string().uuid(),
  worn_at: timestampSchema,
  occasion: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export type GarmentListItem = z.infer<typeof garmentListItemSchema> & {
  images: z.infer<typeof garmentImageSchema>[];
  three_d_assets: z.infer<typeof garment3dAssetRowSchema>[];
  preview_url: string | null;
  recent_wear_events: z.infer<typeof garmentRecentWearSchema>[];
};

function featureImageTypeRank(imageType: z.infer<typeof garmentImageSchema>["image_type"]) {
  switch (imageType) {
    case "cutout":
      return 0;
    case "cropped":
      return 1;
    case "thumbnail":
      return 2;
    case "original":
    default:
      return 3;
  }
}

function getPreferredFeatureImageId(extractionMetadata: Json | null | undefined) {
  const value =
    extractionMetadata &&
    typeof extractionMetadata === "object" &&
    "preferred_feature_image_id" in extractionMetadata
      ? extractionMetadata["preferred_feature_image_id"]
      : null;

  return typeof value === "string" && value.length > 0 ? value : null;
}

export function getFeatureImagePath(
  images: z.infer<typeof garmentImageSchema>[],
  preferredImageId?: string | null
) {
  if (preferredImageId) {
    const preferredImage = images.find((image) => image.id === preferredImageId);
    if (preferredImage) {
      return preferredImage.storage_path;
    }
  }

  const featureImage = [...images].sort((left, right) => {
    const rankDiff = featureImageTypeRank(left.image_type) - featureImageTypeRank(right.image_type);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  })[0];

  return featureImage?.storage_path ?? null;
}

async function syncGarmentPrimaryColour(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  garmentId: string;
  primaryColourFamily?: WardrobeColourFamily | null;
}) {
  const { supabase, garmentId, primaryColourFamily } = params;

  const canonicalColour = primaryColourFamily
    ? getCanonicalWardrobeColour(primaryColourFamily)
    : null;

  const { data: existingLinks, error: existingLinksError } = await supabase
    .from("garment_colours")
    .select("id,garment_id,colour_id,dominance,is_primary,created_at")
    .eq("garment_id", garmentId);

  if (existingLinksError) {
    throw new Error(existingLinksError.message);
  }

  const parsedExistingLinks = z
    .array(garmentColourSchema)
    .parse((existingLinks ?? []) satisfies GarmentColourRow[]);

  if (!canonicalColour) {
    const primaryLinkIds = parsedExistingLinks
      .filter((entry) => entry.is_primary)
      .map((entry) => entry.id);

    if (primaryLinkIds.length) {
      const { error: deletePrimaryLinksError } = await supabase
        .from("garment_colours")
        .delete()
        .in("id", primaryLinkIds);

      if (deletePrimaryLinksError) {
        throw new Error(deletePrimaryLinksError.message);
      }
    }

    return {
      primary_colour_family: null,
      primary_colour_hex: null
    };
  }

  const { data: existingColour, error: existingColourError } = await supabase
    .from("colours")
    .select("id,family,hex")
    .eq("family", canonicalColour.family)
    .limit(1)
    .maybeSingle();

  if (existingColourError) {
    throw new Error(existingColourError.message);
  }

  const parsedExistingColour = existingColour
    ? colourSchema.parse(existingColour satisfies ColourRow)
    : null;
  const colourId = parsedExistingColour?.id ?? null;

  // Global colour taxonomy must be seeded via migration, not lazily inserted
  // during a user-owned request path that is protected by read-only RLS.
  if (!colourId) {
    return {
      primary_colour_family: null,
      primary_colour_hex: null
    };
  }

  const linkForColour = parsedExistingLinks.find((entry) => entry.colour_id === colourId);
  const linksToRemove = parsedExistingLinks
    .filter((entry) => entry.is_primary && entry.colour_id !== colourId)
    .map((entry) => entry.id);

  if (linksToRemove.length) {
    const { error: deleteLinksError } = await supabase
      .from("garment_colours")
      .delete()
      .in("id", linksToRemove);

    if (deleteLinksError) {
      throw new Error(deleteLinksError.message);
    }
  }

  if (!linkForColour) {
    const garmentColourPayload: GarmentColourInsert = {
      garment_id: garmentId,
      colour_id: colourId,
      dominance: 1,
      is_primary: true
    };

    const { error: insertLinkError } = await supabase
      .from("garment_colours")
      .insert(garmentColourPayload as never);

    if (insertLinkError) {
      throw new Error(insertLinkError.message);
    }
  } else if (!linkForColour.is_primary || linkForColour.dominance !== 1) {
    const { error: updateLinkError } = await supabase
      .from("garment_colours")
      .update(({ is_primary: true, dominance: 1 } satisfies Partial<GarmentColourInsert>) as never)
      .eq("id", linkForColour.id);

    if (updateLinkError) {
      throw new Error(updateLinkError.message);
    }
  }

  return {
    primary_colour_family: canonicalColour.family,
    primary_colour_hex: canonicalColour.hex
  };
}

export async function setGarmentPrimaryColourFamily(params: {
  garmentId: string;
  primaryColourFamily?: WardrobeColourFamily | null;
}) {
  const supabase = await createClient();
  return syncGarmentPrimaryColour({
    supabase,
    garmentId: z.string().uuid().parse(params.garmentId),
    primaryColourFamily: params.primaryColourFamily ?? null
  });
}

export async function setGarmentFeatureImage(params: {
  garmentId: string;
  imageId: string;
}) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const garmentId = z.string().uuid().parse(params.garmentId);
  const imageId = z.string().uuid().parse(params.imageId);

  const { data: garment, error: garmentError } = await supabase
    .from("garments")
    .select("id,extraction_metadata_json")
    .eq("id", garmentId)
    .eq("user_id", user.id)
    .single();

  if (garmentError || !garment) {
    throw new Error("Garment not found.");
  }

  const currentGarment = garment as {
    id: string;
    extraction_metadata_json: Json | null;
  };

  const { data: image, error: imageError } = await supabase
    .from("garment_images")
    .select("id,garment_id")
    .eq("id", imageId)
    .eq("garment_id", garmentId)
    .single();

  if (imageError || !image) {
    throw new Error("Garment image not found.");
  }

  const currentMetadata =
    currentGarment.extraction_metadata_json &&
    typeof currentGarment.extraction_metadata_json === "object"
      ? (currentGarment.extraction_metadata_json as Record<string, Json | undefined>)
      : {};

  const nextMetadata = {
    ...currentMetadata,
    preferred_feature_image_id: imageId
  } as Json;

  const { error: updateError } = await supabase
    .from("garments")
    .update(({ extraction_metadata_json: nextMetadata } satisfies Partial<GarmentInsert>) as never)
    .eq("id", garmentId)
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

const garmentColourWithColourSchema = garmentColourSchema.extend({
  colours: colourSchema.nullable().optional()
});

const GARMENT_LIST_SELECT =
  "id,user_id,title,description,brand,category,subcategory,pattern,material,size,fit,formality_level,seasonality,wardrobe_status,purchase_price,purchase_currency,purchase_date,retailer,favourite_score,wear_count,last_worn_at,cost_per_wear,extraction_metadata_json,created_at,updated_at," +
  "garment_images(id,garment_id,image_type,storage_path,width,height,created_at)," +
  "garment_colours(id,garment_id,colour_id,dominance,is_primary,created_at,colours(id,family,hex))," +
  "garment_3d_assets(id,garment_id,asset_type,storage_path,file_format,material_profile_json,physics_profile_json,renderer_metadata_json,source_type,confidence,status,created_at,updated_at)," +
  "wear_events(id,garment_id,worn_at,occasion,notes)";

export async function listWardrobeGarments(): Promise<GarmentListItem[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  // Fetch the garments and all of their child rows (images, colour links + the
  // joined colour, 3d assets, recent wears) in a single embedded request. The
  // alternative — a base query followed by one query per child table — costs an
  // extra sequential round-trip per child, which dominates page latency when the
  // database is remote. Embedded resources are ordered individually below.
  const { data: garments, error } = await supabase
    .from("garments")
    .select(GARMENT_LIST_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("created_at", { ascending: false, referencedTable: "garment_images" })
    .order("is_primary", { ascending: false, referencedTable: "garment_colours" })
    .order("dominance", { ascending: false, referencedTable: "garment_colours" })
    .order("created_at", { ascending: false, referencedTable: "garment_3d_assets" })
    .order("worn_at", { ascending: false, referencedTable: "wear_events" });

  if (error) {
    throw new Error(error.message);
  }

  const rawRows = (garments ?? []) as Array<Record<string, unknown>>;
  const parsedGarments = z.array(garmentListItemSchema).parse(rawRows);

  if (!parsedGarments.length) {
    return [];
  }

  const imagesByGarment = new Map<string, z.infer<typeof garmentImageSchema>[]>();
  const featureImagePathByGarment = new Map<string, string>();
  const primaryColourByGarment = new Map<string, { family: string | null; hex: string | null }>();
  const recentWearByGarment = new Map<string, z.infer<typeof garmentRecentWearSchema>[]>();
  const threeDAssetsByGarment = new Map<string, z.infer<typeof garment3dAssetRowSchema>[]>();

  for (const row of rawRows) {
    const garmentId = row.id as string;

    const garmentImages = z.array(garmentImageSchema).parse(row.garment_images ?? []);
    imagesByGarment.set(garmentId, garmentImages);
    const featureImagePath = getFeatureImagePath(garmentImages);
    if (featureImagePath) {
      featureImagePathByGarment.set(garmentId, featureImagePath);
    }

    // Rows arrive ordered is_primary desc, dominance desc, so the first primary
    // link is the dominant primary colour — same selection as before.
    const colourLinks = z.array(garmentColourWithColourSchema).parse(row.garment_colours ?? []);
    const primaryLink = colourLinks.find((link) => link.is_primary);
    if (primaryLink) {
      primaryColourByGarment.set(garmentId, {
        family: primaryLink.colours?.family ?? null,
        hex: primaryLink.colours?.hex ?? null
      });
    }

    const assets = z.array(garment3dAssetRowSchema).parse(row.garment_3d_assets ?? []);
    threeDAssetsByGarment.set(garmentId, assets);

    // Already ordered worn_at desc; keep the three most recent.
    const wears = z.array(garmentRecentWearSchema).parse(row.wear_events ?? []);
    recentWearByGarment.set(garmentId, wears.slice(0, 3));
  }

  const firstImagePaths = Array.from(featureImagePathByGarment.values());
  const previewUrlsByPath = new Map<string, string | null>();

  // Signed URLs are a Storage-API call (not a PostgREST query), so they remain a
  // separate round-trip — but it's the only one left after the embedded read.
  if (firstImagePaths.length) {
    const { data: signedUrls, error: signedUrlError } = await supabase.storage
      .from("garment-originals")
      .createSignedUrls(firstImagePaths, 60 * 60);

    if (signedUrlError) {
      throw new Error(signedUrlError.message);
    }

    for (const signedUrl of signedUrls) {
      if (signedUrl.path) {
        previewUrlsByPath.set(signedUrl.path, signedUrl.signedUrl ?? null);
      }
    }
  }

  return parsedGarments.map((garment): GarmentListItem => {
    const garmentImages = (imagesByGarment.get(garment.id as string) ?? []).map((image) => ({
      ...image,
      preview_url: previewUrlsByPath.get(image.storage_path) ?? null
    }));
    const preferredFeatureImageId = getPreferredFeatureImageId(garment.extraction_metadata_json as Json);
    const primaryColour = primaryColourByGarment.get(garment.id as string);

    return {
      ...garment,
      primary_colour_family: primaryColour?.family ?? null,
      primary_colour_hex: primaryColour?.hex ?? null,
      images: garmentImages,
      three_d_assets: threeDAssetsByGarment.get(garment.id as string) ?? [],
      recent_wear_events: recentWearByGarment.get(garment.id as string) ?? [],
      preview_url: (() => {
        const firstPath =
          getFeatureImagePath(garmentImages, preferredFeatureImageId) ??
          featureImagePathByGarment.get(garment.id as string);
        return firstPath ? previewUrlsByPath.get(firstPath) ?? null : null;
      })()
    };
  });
}

export async function createGarment(
  input: z.input<typeof createGarmentSchema>,
  options?: { primaryColourFamily?: WardrobeColourFamily | null }
) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedPayload = garmentSchema.parse({
    ...input,
    user_id: user.id
  });
  const payload: GarmentInsert = {
    ...parsedPayload,
    cost_per_wear:
      parsedPayload.purchase_price != null ? parsedPayload.purchase_price : null,
    extraction_metadata_json: parsedPayload.extraction_metadata_json as Json
  };

  const { data, error } = await supabase
    .from("garments")
    .insert(payload as never)
    .select(
      "id,user_id,title,description,brand,category,subcategory,pattern,material,size,fit,formality_level,seasonality,wardrobe_status,purchase_price,purchase_currency,purchase_date,retailer,wear_count,last_worn_at,cost_per_wear,extraction_metadata_json,created_at,updated_at"
      .replace("retailer,", "retailer,favourite_score,")
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const createdGarmentRow: GarmentListRow | null = data ?? null;

  if (!createdGarmentRow) {
    throw new Error("Garment insert returned no data.");
  }

  const garment = garmentListItemSchema.parse({
    ...(createdGarmentRow as GarmentListRow),
    primary_colour_family: null,
    primary_colour_hex: null
  });

  const colourState = await syncGarmentPrimaryColour({
    supabase,
    garmentId: garment.id as string,
    primaryColourFamily: options?.primaryColourFamily
  });

  return {
    ...garment,
    ...colourState,
    images: [],
    three_d_assets: [],
    recent_wear_events: [],
    preview_url: null
  };
}

export async function updateGarment(
  garmentId: string,
  input: z.input<typeof createGarmentSchema>,
  options?: { primaryColourFamily?: WardrobeColourFamily | null }
) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedGarmentId = z.string().uuid().parse(garmentId);
  const parsedPayload = createGarmentSchema.parse(input);

  const payload: Partial<GarmentInsert> = {
    ...parsedPayload,
    extraction_metadata_json: parsedPayload.extraction_metadata_json as Json
  };

  const { data, error } = await supabase
    .from("garments")
    .update(payload as never)
    .eq("id", parsedGarmentId)
    .eq("user_id", user.id)
    .select(
      "id,user_id,title,description,brand,category,subcategory,pattern,material,size,fit,formality_level,seasonality,wardrobe_status,purchase_price,purchase_currency,purchase_date,retailer,wear_count,last_worn_at,cost_per_wear,extraction_metadata_json,created_at,updated_at"
      .replace("retailer,", "retailer,favourite_score,")
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const updatedGarmentRow: GarmentListRow | null = data ?? null;

  if (!updatedGarmentRow) {
    throw new Error("Garment update returned no data.");
  }

  const garment = garmentListItemSchema.parse({
    ...(updatedGarmentRow as GarmentListRow),
    primary_colour_family: null,
    primary_colour_hex: null
  });

  const colourState = await syncGarmentPrimaryColour({
    supabase,
    garmentId: garment.id as string,
    primaryColourFamily: options?.primaryColourFamily
  });

  return {
    ...garment,
    ...colourState,
    images: [],
    three_d_assets: [],
    recent_wear_events: [],
    preview_url: null
  };
}

export async function deleteGarment(garmentId: string) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(garmentId);

  const { error } = await supabase
    .from("garments")
    .delete()
    .eq("id", parsedId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function toggleGarmentFavourite(garmentId: string) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(garmentId);

  const { data: garment, error: garmentError } = await supabase
    .from("garments")
    .select("id,favourite_score")
    .eq("id", parsedId)
    .eq("user_id", user.id)
    .single();

  if (garmentError || !garment) {
    throw new Error("Garment not found.");
  }

  const parsedGarment = garmentFavouriteLookupSchema.parse(
    garment satisfies GarmentFavouriteLookupRow
  );
  const nextFavouriteScore =
    parsedGarment.favourite_score && parsedGarment.favourite_score > 0 ? null : 1;

  const { error } = await supabase
    .from("garments")
    .update(({ favourite_score: nextFavouriteScore } satisfies Partial<GarmentInsert>) as never)
    .eq("id", parsedId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function addGarmentImage(params: {
  garmentId: string;
  file: File;
  width?: number;
  height?: number;
}) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const garmentId = z.string().uuid().parse(params.garmentId);

  const { data: garment, error: garmentError } = await supabase
    .from("garments")
    .select("id")
    .eq("id", garmentId)
    .eq("user_id", user.id)
    .single();

  if (garmentError || !garment) {
    throw new Error("Garment not found.");
  }

  const safeFileName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${user.id}/${garmentId}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("garment-originals")
    .upload(storagePath, params.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: params.file.type || undefined
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: source, error: sourceError } = await supabase
    .from("garment_sources")
    .insert(({
      garment_id: garmentId,
      user_id: user.id,
      source_type: "direct_upload",
      storage_path: storagePath,
      parse_status: "completed",
      confidence: 1,
      source_metadata_json: {
        filename: params.file.name,
        mime_type: params.file.type || null
      }
    } satisfies GarmentSourceInsert) as never)
    .select("id")
    .single();

  if (sourceError) {
    await supabase.storage.from("garment-originals").remove([storagePath]);
    throw new Error(sourceError.message);
  }

  const parsedSource = garmentSourceSchema.parse(source);

  const { data: image, error: imageError } = await supabase
    .from("garment_images")
    .insert(({
      garment_id: garmentId,
      image_type: "original",
      storage_path: storagePath,
      width: params.width,
      height: params.height
    } satisfies GarmentImageInsert) as never)
    .select("id,garment_id,image_type,storage_path,width,height,created_at")
    .single();

  if (imageError) {
    await supabase
      .from("garment_sources")
      .delete()
      .eq("id", parsedSource.id)
      .eq("user_id", user.id);
    await supabase.storage.from("garment-originals").remove([storagePath]);
    throw new Error(imageError.message);
  }

  return {
    image: garmentImageSchema.parse(image),
    sourceId: parsedSource.id
  };
}

export async function addGarment3dAsset(params: {
  garmentId: string;
  file?: File | null;
  assetType: z.input<typeof garment3dAssetSchema>["asset_type"];
  fileFormat?: string | null;
  materialProfile?: Record<string, unknown>;
  physicsProfile?: Record<string, unknown>;
  rendererMetadata?: Record<string, unknown>;
  sourceType?: z.input<typeof garment3dAssetSchema>["source_type"];
  confidence?: number | null;
  status?: z.input<typeof garment3dAssetSchema>["status"];
}) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const garmentId = z.string().uuid().parse(params.garmentId);

  const { data: garment, error: garmentError } = await supabase
    .from("garments")
    .select("id")
    .eq("id", garmentId)
    .eq("user_id", user.id)
    .single();

  if (garmentError || !garment) {
    throw new Error("Garment not found.");
  }

  let storagePath: string | null = null;
  const inferredFormat = params.file
    ? inferAssetFormat(params.file.name, params.file.type)
    : params.fileFormat;

  if (params.file && params.file.size > 0) {
    const safeName = safeStorageFileName(params.file.name || `garment-asset.${inferredFormat || "bin"}`);
    storagePath = `${user.id}/${garmentId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("garment-3d-assets")
      .upload(storagePath, params.file, {
        cacheControl: "3600",
        contentType: params.file.type || undefined,
        upsert: false
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }
  }

  const parsedAsset = garment3dAssetSchema.parse({
    asset_type: params.assetType,
    storage_path: storagePath,
    file_format: inferredFormat,
    material_profile_json: params.materialProfile ?? {},
    physics_profile_json: params.physicsProfile ?? {},
    renderer_metadata_json: {
      ...(params.rendererMetadata ?? {}),
      original_filename: params.file?.name ?? null,
      mime_type: params.file?.type ?? null
    },
    source_type: params.sourceType ?? "manual",
    confidence: params.confidence ?? (params.file ? 0.75 : null),
    status: params.status ?? (params.file ? "ready" : "draft")
  });

  const payload: Garment3dAssetInsert = {
    garment_id: garmentId,
    asset_type: parsedAsset.asset_type,
    storage_path: parsedAsset.storage_path ?? null,
    file_format: parsedAsset.file_format ?? null,
    material_profile_json: parsedAsset.material_profile_json as Json,
    physics_profile_json: parsedAsset.physics_profile_json as Json,
    renderer_metadata_json: parsedAsset.renderer_metadata_json as Json,
    source_type: parsedAsset.source_type,
    confidence: parsedAsset.confidence ?? null,
    status: parsedAsset.status
  };

  const { data, error } = await supabase
    .from("garment_3d_assets")
    .insert(payload as never)
    .select(
      "id,garment_id,asset_type,storage_path,file_format,material_profile_json,physics_profile_json,renderer_metadata_json,source_type,confidence,status,created_at,updated_at"
    )
    .single();

  if (error) {
    if (storagePath) {
      await supabase.storage.from("garment-3d-assets").remove([storagePath]);
    }
    throw new Error(error.message);
  }

  return garment3dAssetRowSchema.parse(data as Garment3dAssetRow);
}

export async function addGarmentImageFromUrl(params: {
  garmentId: string;
  imageUrl: string;
  fileNameHint?: string | null;
  cropBox?: [number, number, number, number] | null;
}) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const garmentId = z.string().uuid().parse(params.garmentId);

  const { data: garment, error: garmentError } = await supabase
    .from("garments")
    .select("id")
    .eq("id", garmentId)
    .eq("user_id", user.id)
    .single();

  if (garmentError || !garment) {
    throw new Error("Garment not found.");
  }

  const imageResponse = await fetch(params.imageUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; PocketWardrobeBot/0.1; +https://example.com/bot)"
    },
    cache: "no-store",
    signal: AbortSignal.timeout(PRODUCT_IMAGE_FETCH_TIMEOUT_MS)
  });

  if (!imageResponse.ok) {
    throw new Error(`Image fetch failed with status ${imageResponse.status}.`);
  }

  const imageBlob = await imageResponse.blob();
  const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());
  const parsedImageUrl = new URL(params.imageUrl);
  const inferredExtension =
    parsedImageUrl.pathname.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const baseName =
    params.fileNameHint?.trim().replace(/[^a-zA-Z0-9._-]/g, "-") ||
    `product-image.${inferredExtension}`;
  const safeFileName = baseName.includes(".") ? baseName : `${baseName}.${inferredExtension}`;
  const storagePath = `${user.id}/${garmentId}/${Date.now()}-${safeFileName}`;
  const featureDerivative = await buildFeatureDerivative({
    sourceBuffer: imageBuffer,
    contentType: imageBlob.type || null,
    cropBox: params.cropBox ?? null
  });
  const derivativePath = `${user.id}/${garmentId}/${Date.now()}-feature-${safeFileName.replace(/\.[^.]+$/, "")}.jpg`;
  const colourAnalysis = await analyseImageColours(featureDerivative.buffer);

  const { error: uploadError } = await supabase.storage
    .from("garment-originals")
    .upload(storagePath, imageBuffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: imageBlob.type || undefined
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: derivativeUploadError } = await supabase.storage
    .from("garment-originals")
    .upload(derivativePath, featureDerivative.buffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: featureDerivative.contentType
    });

  if (derivativeUploadError) {
    await supabase.storage.from("garment-originals").remove([storagePath]);
    throw new Error(derivativeUploadError.message);
  }

  const { data: images, error: imageError } = await supabase
    .from("garment_images")
    .insert(([
      {
        garment_id: garmentId,
        image_type: "original",
        storage_path: storagePath,
        width: null,
        height: null
      },
      {
        garment_id: garmentId,
        image_type: params.cropBox ? "cutout" : "cropped",
        storage_path: derivativePath,
        width: featureDerivative.width,
        height: featureDerivative.height
      }
    ] satisfies GarmentImageInsert[]) as never)
    .select("id,garment_id,image_type,storage_path,width,height,created_at")
    ;

  if (imageError) {
    await supabase.storage.from("garment-originals").remove([storagePath, derivativePath]);
    throw new Error(imageError.message);
  }

  return {
    images: z.array(garmentImageSchema).parse((images ?? []) satisfies GarmentImageRow[]),
    storagePath,
    featureStoragePath: derivativePath,
    colourAnalysis
  };
}

export async function getDashboardStats(): Promise<{
  garmentCount: number;
  favouritesCount: number;
  pendingDraftsCount: number;
}> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const [garments, favourites, drafts] = await Promise.all([
    supabase
      .from("garments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("garments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gt("favourite_score", 0),
    supabase
      .from("garment_drafts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending"),
  ]);

  if (garments.error) throw new Error(garments.error.message);
  if (favourites.error) throw new Error(favourites.error.message);
  if (drafts.error) throw new Error(drafts.error.message);

  return {
    garmentCount: garments.count ?? 0,
    favouritesCount: favourites.count ?? 0,
    pendingDraftsCount: drafts.count ?? 0,
  };
}

export async function getRecentGarments(n: number): Promise<
  Array<{
    id: string;
    title: string | null;
    category: string;
    storagePath: string | null;
  }>
> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data: rawData, error } = await supabase
    .from("garments")
    .select("id, title, category, garment_images(storage_path,image_type,width,height,created_at,id,garment_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(n);

  if (error) throw new Error(error.message);

  type RawRow = {
    id: string;
    title: string | null;
    category: string;
    garment_images: Array<z.infer<typeof garmentImageSchema>> | null;
  };
  const data = (rawData ?? []) as unknown as RawRow[];

  return data.map((g) => ({
    id: g.id,
    title: g.title ?? null,
    category: g.category,
    storagePath: g.garment_images && g.garment_images.length > 0
      ? getFeatureImagePath(g.garment_images)
      : null,
  }));
}

function inferAssetFormat(fileName: string, contentType?: string | null) {
  const extension = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (extension) {
    return extension;
  }

  if (contentType?.includes("gltf")) {
    return "gltf";
  }

  if (contentType?.includes("glb")) {
    return "glb";
  }

  if (contentType?.includes("json")) {
    return "json";
  }

  return null;
}

function safeStorageFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "garment-asset.bin";
}
