import { AuthenticationError } from "@/lib/auth";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import {
  getActiveAvatarMeasurementSet,
  getAvatarProfile
} from "@/lib/domain/avatar/service";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { AvatarStyler } from "@/components/avatar-styler";
import {
  generateAvatarPhotoAction,
  saveAvatarMeasurementsAction,
  saveAvatarLayoutAction,
  uploadAvatarPhotoAction
} from "@/app/wardrobe/avatar-actions";

export default async function ClosetAvatarPage() {
  try {
    const [garments, avatarProfile, avatarMeasurementSet] = await Promise.all([
      listWardrobeGarments(),
      getAvatarProfile(),
      getActiveAvatarMeasurementSet()
    ]);

    return (
      <div className="flex flex-col gap-6 px-4 py-6 md:px-0">
        <AvatarStyler
          garments={garments}
          initialAvatarUrl={avatarProfile?.avatar_url ?? null}
          initialLayout={avatarProfile?.layout_json ?? null}
          initialMeasurementSet={avatarMeasurementSet}
          uploadAvatarPhotoAction={uploadAvatarPhotoAction}
          generateAvatarPhotoAction={generateAvatarPhotoAction}
          saveAvatarLayoutAction={saveAvatarLayoutAction}
          saveAvatarMeasurementsAction={saveAvatarMeasurementsAction}
        />
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/wardrobe/avatar"
          title="Sign in with Supabase to use the wardrobe workspace."
          description="This page reads and writes user-owned tables protected by RLS, so it requires an authenticated Supabase session."
        />
      );
    }
    throw error;
  }
}
