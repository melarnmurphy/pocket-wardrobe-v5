import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import {
  createLookbookEntrySchema,
  createLookbookItemSchema,
  lookbookEntrySchema
} from "@/lib/domain/lookbook";
import type { Json, Tables, TablesInsert } from "@/types/database";

type LookbookEntryRow = Tables<"lookbook_entries">;
type LookbookEntryInsert = TablesInsert<"lookbook_entries">;
type LookbookItemInsert = TablesInsert<"lookbook_items">;
type GarmentRow = Tables<"garments">;

const timestampSchema = z.string().min(1);

const lookbookListItemSchema = lookbookEntrySchema.extend({
  id: z.string().uuid(),
  created_at: timestampSchema
});

const lookbookItemListSchema = z.object({
  id: z.string().uuid(),
  lookbook_entry_id: z.string().uuid(),
  garment_id: z.string().uuid().nullable().optional(),
  desired_item_json: z.record(z.string(), z.unknown()).nullable().optional(),
  role: z.string().trim().max(80).nullable().optional(),
  created_at: timestampSchema
});

const wardrobeLookupSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  category: z.string(),
  brand: z.string().nullable()
});

const idLookupSchema = z.object({
  id: z.string().uuid()
});

export type LookbookItemList = z.infer<typeof lookbookItemListSchema>;
export type LookbookListItem = z.infer<typeof lookbookListItemSchema> & {
  items: LookbookItemList[];
  preview_url: string | null;
};
export type WardrobeLookupItem = z.infer<typeof wardrobeLookupSchema>;

export async function listLookbookEntries(): Promise<LookbookListItem[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lookbook_entries")
    .select(
      "id,user_id,title,description,source_type,source_url,image_path,aesthetic_tags,occasion_tags,created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const parsedEntries = z
    .array(lookbookListItemSchema)
    .parse((data ?? []) satisfies LookbookEntryRow[]);

  if (!parsedEntries.length) {
    return [];
  }

  const entryIds = parsedEntries.map((entry) => entry.id);

  const { data: items, error: itemError } = await supabase
    .from("lookbook_items")
    .select("id,lookbook_entry_id,garment_id,desired_item_json,role,created_at")
    .in("lookbook_entry_id", entryIds)
    .order("created_at", { ascending: true });

  if (itemError) {
    throw new Error(itemError.message);
  }

  const parsedItems = z.array(lookbookItemListSchema).parse(items ?? []);
  const itemsByEntry = new Map<string, LookbookItemList[]>();
  const imagePaths = parsedEntries
    .map((entry) => entry.image_path)
    .filter((path): path is string => Boolean(path));
  const previewUrlsByPath = new Map<string, string | null>();

  for (const item of parsedItems) {
    const existing = itemsByEntry.get(item.lookbook_entry_id) ?? [];
    existing.push(item);
    itemsByEntry.set(item.lookbook_entry_id, existing);
  }

  if (imagePaths.length) {
    const { data: signedUrls, error: signedUrlError } = await supabase.storage
      .from("lookbook-images")
      .createSignedUrls(imagePaths, 60 * 60);

    if (signedUrlError) {
      throw new Error(signedUrlError.message);
    }

    for (const signedUrl of signedUrls) {
      if (signedUrl.path) {
        previewUrlsByPath.set(signedUrl.path, signedUrl.signedUrl ?? null);
      }
    }
  }

  return parsedEntries.map((entry) => ({
    ...entry,
    items: itemsByEntry.get(entry.id) ?? [],
    preview_url: entry.image_path ? previewUrlsByPath.get(entry.image_path) ?? null : null
  }));
}

export async function createLookbookEntry(
  input: z.input<typeof createLookbookEntrySchema>,
  file?: File
) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  let uploadedImagePath: string | null = null;

  if (file && file.size > 0) {
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    uploadedImagePath = `${user.id}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("lookbook-images")
      .upload(uploadedImagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }
  }

  const payload: LookbookEntryInsert = lookbookEntrySchema.parse({
    ...input,
    image_path: uploadedImagePath ?? input.image_path,
    user_id: user.id
  });

  const { data, error } = await supabase
    .from("lookbook_entries")
    .insert(payload as never)
    .select(
      "id,user_id,title,description,source_type,source_url,image_path,aesthetic_tags,occasion_tags,created_at"
    )
    .single();

  if (error) {
    if (uploadedImagePath) {
      await supabase.storage.from("lookbook-images").remove([uploadedImagePath]);
    }
    throw new Error(error.message);
  }

  return lookbookListItemSchema.parse(data);
}

export async function deleteLookbookEntry(entryId: string) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(entryId);

  const { error } = await supabase
    .from("lookbook_entries")
    .delete()
    .eq("id", parsedId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateLookbookEntry(
  entryId: string,
  input: z.input<typeof createLookbookEntrySchema>
) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(entryId);
  const payload = createLookbookEntrySchema.parse(input);

  const { data, error } = await supabase
    .from("lookbook_entries")
    .update(payload as never)
    .eq("id", parsedId)
    .eq("user_id", user.id)
    .select(
      "id,user_id,title,description,source_type,source_url,image_path,aesthetic_tags,occasion_tags,created_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return lookbookListItemSchema.parse(data);
}

export async function createLookbookItem(
  input: z.input<typeof createLookbookItemSchema>
) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedPayload = createLookbookItemSchema.parse(input);

  const { data: entry, error: entryError } = await supabase
    .from("lookbook_entries")
    .select("id")
    .eq("id", parsedPayload.lookbook_entry_id)
    .eq("user_id", user.id)
    .single();

  if (entryError || !entry) {
    throw new Error("Lookbook entry not found.");
  }

  if (parsedPayload.garment_id) {
    const { data: garment, error: garmentError } = await supabase
      .from("garments")
      .select("id")
      .eq("id", parsedPayload.garment_id)
      .eq("user_id", user.id)
      .single();

    if (garmentError || !garment) {
      throw new Error("Garment not found.");
    }
  }

  const payload: LookbookItemInsert = {
    ...parsedPayload,
    desired_item_json: (parsedPayload.desired_item_json ?? null) as Json | null
  };

  const { data, error } = await supabase
    .from("lookbook_items")
    .insert(payload as never)
    .select("id,lookbook_entry_id,garment_id,desired_item_json,role,created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return lookbookItemListSchema.parse(data);
}

export async function deleteLookbookItem(itemId: string) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(itemId);
  const { data: entries, error: entriesError } = await supabase
    .from("lookbook_entries")
    .select("id")
    .eq("user_id", user.id);

  if (entriesError) {
    throw new Error(entriesError.message);
  }

  const entryIds = z
    .array(idLookupSchema)
    .parse(entries ?? [])
    .map((entry) => entry.id);

  if (!entryIds.length) {
    return;
  }

  const { error } = await supabase
    .from("lookbook_items")
    .delete()
    .eq("id", parsedId)
    .in("lookbook_entry_id", entryIds);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateLookbookItem(
  itemId: string,
  input: z.input<typeof createLookbookItemSchema>
) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(itemId);
  const parsedPayload = createLookbookItemSchema.parse(input);

  const { data: entry, error: entryError } = await supabase
    .from("lookbook_entries")
    .select("id")
    .eq("id", parsedPayload.lookbook_entry_id)
    .eq("user_id", user.id)
    .single();

  if (entryError || !entry) {
    throw new Error("Lookbook entry not found.");
  }

  if (parsedPayload.garment_id) {
    const { data: garment, error: garmentError } = await supabase
      .from("garments")
      .select("id")
      .eq("id", parsedPayload.garment_id)
      .eq("user_id", user.id)
      .single();

    if (garmentError || !garment) {
      throw new Error("Garment not found.");
    }
  }

  const payload: LookbookItemInsert = {
    ...parsedPayload,
    desired_item_json: (parsedPayload.desired_item_json ?? null) as Json | null
  };

  const { data, error } = await supabase
    .from("lookbook_items")
    .update(payload as never)
    .eq("id", parsedId)
    .select("id,lookbook_entry_id,garment_id,desired_item_json,role,created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return lookbookItemListSchema.parse(data);
}

export async function listWardrobeOptionsForLookbook(): Promise<WardrobeLookupItem[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("garments")
    .select("id,title,category,brand")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(wardrobeLookupSchema).parse((data ?? []) satisfies Pick<
    GarmentRow,
    "id" | "title" | "category" | "brand"
  >[]);
}
