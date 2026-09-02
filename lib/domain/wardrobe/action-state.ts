export type WardrobeActionState = {
  status: "idle" | "success" | "error" | "partial" | "blocked";
  message: string | null;
  garmentId?: string;
  draftIds?: string[];
  nextPath?: string;
  blocked?: { activeOutfitCount: number; activeListingId: string | null };
};

export const wardrobeActionState: WardrobeActionState = {
  status: "idle",
  message: null
};
