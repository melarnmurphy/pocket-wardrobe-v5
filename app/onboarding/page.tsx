import { redirect } from "next/navigation";
import { getOrCreateProfile } from "@/lib/domain/profile/service";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { OnboardingFlow } from "./onboarding-flow";

/**
 * 6a / w4a-w4c — resumable across sessions (this is one responsive web
 * app, so "web and phone resume each other" collapses to "coming back
 * later resumes where you left off"). Progress lives on profiles
 * (onboarding_completed_at) and, for the photo step, on the existing
 * photo_batches machinery from phase 3 — nothing new to track there.
 */
export default async function OnboardingPage() {
  try {
    const profile = await getOrCreateProfile();

    if (profile.onboarding_completed_at) {
      redirect("/wardrobe");
    }

    const garments = await listWardrobeGarments();

    return (
      <OnboardingFlow
        hasGarments={garments.length > 0}
        suburb={profile.suburb}
        topsSize={profile.tops_size}
      />
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/onboarding"
          title="Sign in with Supabase to get started."
          description="Onboarding writes to your own profile, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
