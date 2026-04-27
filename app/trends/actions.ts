"use server";

import { getRequiredUser } from "@/lib/auth";
import {
  getUserTrendMatches,
  getTrendSignals,
  getTrendStories,
  assembleStoryMatches,
  type TrendStoryWithMatches
} from "@/lib/domain/trends/service";
import type { UserTrendMatch, TrendSignalWithColour } from "@/lib/domain/trends/index";
import { createClient } from "@/lib/supabase/server";

export interface TrendMatchWithSignal {
  match: UserTrendMatch;
  signal: TrendSignalWithColour;
}

export interface GarmentPreview {
  id: string;
  title: string;
  preview_url: string | null;
}

export interface TrendsPageData {
  trendMatches: TrendMatchWithSignal[];
  storyMatches: TrendStoryWithMatches[];
  garmentPreviews: Record<string, GarmentPreview>;
}

export async function loadTrendsPageData(): Promise<TrendsPageData> {
  const user = await getRequiredUser();

  const [matches, signals, stories] = await Promise.all([
    getUserTrendMatches(user.id),
    getTrendSignals(),
    getTrendStories()
  ]);

  // Per-signal view
  const signalById = new Map(signals.map((s) => [s.id, s]));
  const trendMatches: TrendMatchWithSignal[] = matches
    .map((match) => {
      const signal = signalById.get(match.trend_signal_id);
      if (!signal) return null;
      return { match, signal };
    })
    .filter((item): item is TrendMatchWithSignal => item !== null)
    .sort((a, b) => b.match.score - a.match.score);

  // Story view — reuse same matches
  const storyMatches = assembleStoryMatches(stories, matches);

  // Garment previews for story cards
  const allGarmentIds = [
    ...new Set(storyMatches.flatMap((sm) => sm.matchingGarmentIds))
  ];
  const garmentPreviews: Record<string, GarmentPreview> = {};

  if (allGarmentIds.length > 0) {
    const supabase = await createClient();
    const { data: garments } = await supabase
      .from("garments")
      .select(
        "id,title,garment_images(storage_path,image_type,created_at,id,garment_id,width,height)"
      )
      .in("id", allGarmentIds);

    for (const g of (garments ?? []) as Array<{
      id: string;
      title: string;
      garment_images: Array<{
        storage_path: string;
        image_type: string;
        created_at: string;
      }> | null;
    }>) {
      const images = g.garment_images ?? [];
      const featureImage =
        images.find((img) => img.image_type === "cutout") ??
        images.find((img) => img.image_type === "cropped") ??
        images.find((img) => img.image_type === "thumbnail") ??
        images[0];

      let preview_url: string | null = null;
      if (featureImage?.storage_path) {
        const { data: urlData } = supabase.storage
          .from("garment-images")
          .getPublicUrl(featureImage.storage_path);
        preview_url = urlData?.publicUrl ?? null;
      }
      garmentPreviews[g.id] = { id: g.id, title: g.title, preview_url };
    }
  }

  return { trendMatches, storyMatches, garmentPreviews };
}
