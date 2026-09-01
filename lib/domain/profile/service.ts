import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import {
  localPrivacySchema,
  profileSchema,
  sizesSchema,
  updateProfileSchema,
  type LocalPrivacyInput,
  type Profile,
  type PublicProfilePreview,
  type SizesInput,
  type UpdateProfileInput
} from "@/lib/domain/profile";
import { resolveSuburbCentroid } from "@/lib/domain/local-threads/adelaide-suburbs";
import type { TablesInsert, TablesUpdate } from "@/types/database";

type ProfileInsert = TablesInsert<"profiles">;
type ProfileUpdate = TablesUpdate<"profiles">;

const PROFILE_SELECT =
  "user_id,local_name,suburb,tops_size,bottoms_size,shoes_size,tops_size_system,bottoms_size_system,shoes_size_system,height_cm,one_size_either_way,show_suburb,show_wear_count,suburb_lat,suburb_lng,radius_km,onboarding_completed_at,created_at,updated_at";

/** No signup trigger creates this row — it's created lazily on first read. */
export const getOrCreateProfile = cache(async (): Promise<Profile> => {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (existing) {
    return profileSchema.parse(existing);
  }

  const insert: ProfileInsert = { user_id: user.id };
  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert(insert as never)
    .select(PROFILE_SELECT)
    .single();

  if (insertError || !created) {
    throw new Error(insertError?.message ?? "Unable to create a profile.");
  }

  return profileSchema.parse(created);
});

export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  await getOrCreateProfile();
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsed = updateProfileSchema.parse(input);
  const centroid = resolveSuburbCentroid(parsed.suburb);

  const update: ProfileUpdate = {
    ...parsed,
    suburb_lat: centroid?.lat ?? null,
    suburb_lng: centroid?.lng ?? null
  };
  const { data, error } = await supabase
    .from("profiles")
    .update(update as never)
    .eq("user_id", user.id)
    .select(PROFILE_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update your profile.");
  }

  return profileSchema.parse(data);
}

export async function updateSizes(input: SizesInput): Promise<Profile> {
  await getOrCreateProfile();
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsed = sizesSchema.parse(input);

  const update: ProfileUpdate = parsed;
  const { data, error } = await supabase
    .from("profiles")
    .update(update as never)
    .eq("user_id", user.id)
    .select(PROFILE_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update your sizes.");
  }

  return profileSchema.parse(data);
}

export async function updateLocalPrivacy(input: LocalPrivacyInput): Promise<Profile> {
  await getOrCreateProfile();
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsed = localPrivacySchema.parse(input);

  const update: ProfileUpdate = parsed;
  const { data, error } = await supabase
    .from("profiles")
    .update(update as never)
    .eq("user_id", user.id)
    .select(PROFILE_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update your privacy settings.");
  }

  return profileSchema.parse(data);
}

/** 6a/w4a-c — marks onboarding done so /onboarding stops intercepting sign-in. */
export async function completeOnboarding(): Promise<void> {
  await getOrCreateProfile();
  const user = await getRequiredUser();
  const supabase = await createClient();

  const update: ProfileUpdate = { onboarding_completed_at: new Date().toISOString() };
  const { error } = await supabase.from("profiles").update(update as never).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

/** Radius defaults to 30km, user-settable 5-100, persisted on the profile. */
export async function updateRadiusKm(radiusKm: number): Promise<void> {
  await getOrCreateProfile();
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsed = z.number().int().min(5).max(100).parse(radiusKm);

  const update: ProfileUpdate = { radius_km: parsed };
  const { error } = await supabase.from("profiles").update(update as never).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * The self-preview for 17a/w3e — "what other people see" — computed from
 * the signed-in user's own profile with LocalPrivacy applied. This is not
 * yet a genuine cross-user read: local threads (phase 7) is what actually
 * lets another person view this, and that needs its own scoped RLS policy
 * limited to users near a live listing.
 */
export async function getMyPublicProfilePreview(): Promise<PublicProfilePreview> {
  const user = await getRequiredUser();
  const profile = await getOrCreateProfile();

  return {
    userId: user.id,
    localName: profile.local_name,
    suburb: profile.show_suburb ? profile.suburb : null,
    avatarUri: null,
    // auth.users.created_at isn't exposed by getClaims() (it reconstructs a
    // created_at from the JWT's issued-at claim instead, which drifts on
    // every token refresh — not usable as "joined"). profiles.created_at is
    // set once, at first profile read/write, which is close enough and
    // stable, unlike the JWT-derived value.
    joinedAt: profile.created_at,
    handoverCount: 0,
    listedCount: 0
  };
}

const publicProfileRowSchema = z.object({
  user_id: z.string().uuid(),
  local_name: z.string().nullable(),
  suburb: z.string().nullable(),
  show_suburb: z.boolean(),
  created_at: z.string()
});

/**
 * 16b/w2b — "the only cross-user read of a person" (API_CONTRACT.md
 * getPublicProfile). RLS (profiles_select_via_live_listing) only gates
 * which *row* a stranger may read; it does not hide suburb when
 * show_suburb is false, so that masking has to happen here, in code, same
 * as getMyPublicProfilePreview — never trust a raw RLS-permitted row to
 * already reflect LocalPrivacy.
 */
export async function getPublicProfile(userId: string): Promise<PublicProfilePreview | null> {
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(userId);

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,local_name,suburb,show_suburb,created_at")
    .eq("user_id", parsedId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  const row = publicProfileRowSchema.parse(data);

  return {
    userId: row.user_id,
    localName: row.local_name,
    suburb: row.show_suburb ? row.suburb : null,
    avatarUri: null,
    joinedAt: row.created_at,
    handoverCount: 0,
    listedCount: 0
  };
}

const sizesLookupSchema = z.object({
  tops_size: z.string().nullable(),
  bottoms_size: z.string().nullable(),
  shoes_size: z.string().nullable(),
  tops_size_system: z.string(),
  bottoms_size_system: z.string(),
  shoes_size_system: z.string(),
  height_cm: z.number().int().nullable(),
  one_size_either_way: z.boolean()
});

/** Feeds the nearby-listing size filter once local threads (phase 7) exists. */
export async function getMySizes() {
  const profile = await getOrCreateProfile();
  return sizesLookupSchema.parse(profile);
}
