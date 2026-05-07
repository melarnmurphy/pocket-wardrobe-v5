import { z } from "zod";
import OpenAI, { toFile, type Uploadable } from "openai";
import { getRequiredUser } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  avatarMeasurementSetSchema,
  avatarLayoutSchema,
  normalizeAvatarLayout,
  type AvatarMeasurementSetInput,
  type AvatarLayout
} from "@/lib/domain/avatar";
import type { Database, Json, TablesInsert } from "@/types/database";

type AvatarProfileRow = Database["public"]["Tables"]["avatar_profiles"]["Row"];
type AvatarProfileInsert = TablesInsert<"avatar_profiles">;
type AvatarMeasurementSetRow = Database["public"]["Tables"]["avatar_measurement_sets"]["Row"];
type AvatarMeasurementSetInsert = TablesInsert<"avatar_measurement_sets">;

const avatarProfileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  avatar_storage_path: z.string().nullable(),
  layout_json: avatarLayoutSchema,
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  avatar_url: z.string().nullable()
});

export type AvatarProfile = z.infer<typeof avatarProfileSchema>;

const avatarMeasurementSetRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  avatar_profile_id: z.string().uuid().nullable(),
  body_measurements_json: avatarMeasurementSetSchema.shape.body_measurements_json,
  shape_profile_json: avatarMeasurementSetSchema.shape.shape_profile_json,
  skin_tone_json: avatarMeasurementSetSchema.shape.skin_tone_json,
  measurement_system: avatarMeasurementSetSchema.shape.measurement_system,
  capture_method: avatarMeasurementSetSchema.shape.capture_method,
  source_type: avatarMeasurementSetSchema.shape.source_type,
  confidence: z.coerce.number().nullable(),
  status: avatarMeasurementSetSchema.shape.status,
  provenance_metadata_json: z.record(z.unknown()),
  created_at: z.string().min(1),
  updated_at: z.string().min(1)
});

export type AvatarMeasurementSet = z.infer<typeof avatarMeasurementSetRowSchema>;

const DIGITAL_TWIN_AVATAR_PROMPT = `
Create a realistic full-body digital avatar of the person shown in the reference photos.
Preserve the person's face, skin tone, body proportions, hair, and overall identity from the references.
Pose them standing straight, front-facing, with arms relaxed slightly away from the body.
Use a plain white studio background with even lighting and head-to-feet framing.
Dress them in a simple fitted black sports bra and black bike shorts, with bare feet.
Use a neutral expression. Do not stylize, glamorize, beautify, change age, change body shape,
change facial features, add accessories, add logos, or add a fashion pose.
The output should be a clean avatar reference image for wardrobe styling.
`.trim();

export async function getAvatarProfile(): Promise<AvatarProfile | null> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("avatar_profiles")
    .select("id,user_id,avatar_storage_path,layout_json,created_at,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as AvatarProfileRow;
  const avatarUrl = row.avatar_storage_path
    ? await createAvatarSignedUrl(row.avatar_storage_path)
    : null;

  return avatarProfileSchema.parse({
    ...row,
    layout_json: normalizeAvatarLayout(row.layout_json),
    avatar_url: avatarUrl
  });
}

export async function getActiveAvatarMeasurementSet(): Promise<AvatarMeasurementSet | null> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("avatar_measurement_sets")
    .select(
      "id,user_id,avatar_profile_id,measurement_system,body_measurements_json,shape_profile_json,skin_tone_json,capture_method,source_type,confidence,status,provenance_metadata_json,created_at,updated_at"
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? avatarMeasurementSetRowSchema.parse(data as AvatarMeasurementSetRow) : null;
}

export async function saveAvatarMeasurementSet(
  input: AvatarMeasurementSetInput
): Promise<AvatarMeasurementSet> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsed = avatarMeasurementSetSchema.parse(input);
  const avatarProfile = await getAvatarProfile();

  const { error: supersedeError } = await supabase
    .from("avatar_measurement_sets")
    .update({ status: "superseded" } as never)
    .eq("user_id", user.id)
    .eq("status", "active");

  if (supersedeError) {
    throw new Error(supersedeError.message);
  }

  const payload: AvatarMeasurementSetInsert = {
    user_id: user.id,
    avatar_profile_id: avatarProfile?.id ?? null,
    measurement_system: parsed.measurement_system,
    body_measurements_json: parsed.body_measurements_json as Json,
    shape_profile_json: parsed.shape_profile_json as Json,
    skin_tone_json: parsed.skin_tone_json as Json,
    capture_method: parsed.capture_method,
    source_type: parsed.source_type,
    confidence: parsed.confidence ?? null,
    status: parsed.status,
    provenance_metadata_json: {
      entry_surface: "avatar_measurement_form",
      captured_at: new Date().toISOString()
    }
  };

  const { data, error } = await supabase
    .from("avatar_measurement_sets")
    .insert(payload as never)
    .select(
      "id,user_id,avatar_profile_id,measurement_system,body_measurements_json,shape_profile_json,skin_tone_json,capture_method,source_type,confidence,status,provenance_metadata_json,created_at,updated_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return avatarMeasurementSetRowSchema.parse(data as AvatarMeasurementSetRow);
}

export async function uploadAvatarPhoto(file: File): Promise<AvatarProfile> {
  const user = await getRequiredUser();
  const storagePath = `${user.id}/avatar-${Date.now()}-${safeFileName(file.name || "avatar.jpg")}`;

  return saveAvatarImage({
    storagePath,
    body: file,
    contentType: file.type || "image/jpeg"
  });
}

export async function generateAvatarFromReferencePhotos(files: File[]): Promise<AvatarProfile> {
  const user = await getRequiredUser();
  const env = getServerEnv();
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const uploadableImages: Uploadable[] = await Promise.all(
    files.map(async (file, index) => {
      const bytes = await file.arrayBuffer();
      return toFile(bytes, file.name || `avatar-reference-${index + 1}.jpg`, {
        type: file.type || "image/jpeg"
      });
    })
  );

  const response = await client.images.edit({
    model: "gpt-image-1.5",
    image: uploadableImages,
    prompt: DIGITAL_TWIN_AVATAR_PROMPT,
    input_fidelity: "high",
    output_format: "png",
    quality: "high",
    size: "1024x1536",
    n: 1,
    user: user.id
  });

  const b64Json = response.data?.[0]?.b64_json;

  if (!b64Json) {
    throw new Error("OpenAI did not return a generated avatar image.");
  }

  const imageBytes = Buffer.from(b64Json, "base64");
  const storagePath = `${user.id}/generated-avatar-${Date.now()}.png`;

  return saveAvatarImage({
    storagePath,
    body: imageBytes,
    contentType: "image/png"
  });
}

export async function saveAvatarLayout(layout: AvatarLayout): Promise<AvatarProfile> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const normalizedLayout = normalizeAvatarLayout(layout);
  const existingProfile = await getAvatarProfile();
  const payload: AvatarProfileInsert = {
    user_id: user.id,
    avatar_storage_path: existingProfile?.avatar_storage_path ?? null,
    layout_json: normalizedLayout
  };

  const { data, error } = await supabase
    .from("avatar_profiles")
    .upsert(payload as never, { onConflict: "user_id" })
    .select("id,user_id,avatar_storage_path,layout_json,created_at,updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as unknown as AvatarProfileRow;

  return avatarProfileSchema.parse({
    ...row,
    layout_json: normalizeAvatarLayout(row.layout_json),
    avatar_url: row.avatar_storage_path ? await createAvatarSignedUrl(row.avatar_storage_path) : null
  });
}

async function saveAvatarImage({
  storagePath,
  body,
  contentType
}: {
  storagePath: string;
  body: File | Buffer;
  contentType: string;
}): Promise<AvatarProfile> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from("avatar-photos")
    .upload(storagePath, body, {
      cacheControl: "3600",
      contentType,
      upsert: false
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const existingProfile = await getAvatarProfile();
  const payload: AvatarProfileInsert = {
    user_id: user.id,
    avatar_storage_path: storagePath,
    layout_json: existingProfile?.layout_json ?? {}
  };

  const { data, error } = await supabase
    .from("avatar_profiles")
    .upsert(payload as never, { onConflict: "user_id" })
    .select("id,user_id,avatar_storage_path,layout_json,created_at,updated_at")
    .single();

  if (error) {
    await supabase.storage.from("avatar-photos").remove([storagePath]);
    throw new Error(error.message);
  }

  if (existingProfile?.avatar_storage_path) {
    await supabase.storage.from("avatar-photos").remove([existingProfile.avatar_storage_path]);
  }

  const row = data as unknown as AvatarProfileRow;

  return avatarProfileSchema.parse({
    ...row,
    layout_json: normalizeAvatarLayout(row.layout_json),
    avatar_url: await createAvatarSignedUrl(storagePath)
  });
}

async function createAvatarSignedUrl(storagePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("avatar-photos")
    .createSignedUrl(storagePath, 60 * 60);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}

function safeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "avatar.jpg";
}
