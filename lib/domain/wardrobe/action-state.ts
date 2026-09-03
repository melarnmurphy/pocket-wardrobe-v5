export type WardrobeActionState = {
  status: "idle" | "success" | "error" | "partial" | "blocked";
  message: string | null;
  garmentId?: string;
  draftIds?: string[];
  nextPath?: string;
  blocked?: { activeOutfitCount: number; activeListingId: string | null };
  /**
   * Unused for now. Reserved for a future task that redesigns the
   * availability control's UI around a real paywall gate; no action
   * currently sets this field.
   */
  requiresPlus?: boolean;
};

export const wardrobeActionState: WardrobeActionState = {
  status: "idle",
  message: null
};
