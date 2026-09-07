import { AuthenticationError } from "@/lib/auth";
import { listSavedOutfits } from "@/lib/domain/outfits/service";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { OutfitGallery } from "@/components/outfit-gallery";

export default async function ClosetOutfitsPage() {
  try {
    const savedOutfits = await listSavedOutfits();
    return (
      <div className="flex flex-col gap-6 px-4 py-6 md:px-0">
        <OutfitGallery outfits={savedOutfits} />
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/wardrobe/outfits"
          title="Sign in with Supabase to use the wardrobe workspace."
          description="This page reads and writes user-owned tables protected by RLS, so it requires an authenticated Supabase session."
        />
      );
    }
    throw error;
  }
}
