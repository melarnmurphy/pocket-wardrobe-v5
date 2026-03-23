export type WardrobeActionState = {
  status: "idle" | "success" | "error" | "partial";
  message: string | null;
  garmentId?: string;
  draftIds?: string[];
};

export const wardrobeActionState: WardrobeActionState = {
  status: "idle",
  message: null
};
