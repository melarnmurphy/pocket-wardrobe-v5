import type { SupabaseClient } from "@supabase/supabase-js";

export type LabelFields = {
  category: string;
  colour: string;
  material: string;
  style: string;
  brand: string;
  title: string;
};

const COMPARABLE_FIELDS: (keyof LabelFields)[] = [
  "category",
  "colour",
  "material",
  "style",
  "brand",
  "title",
];

const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

export type LabelEventComputation = {
  eventType: "confirmed" | "corrected";
  correctedFields: string[];
};

/**
 * Diff the model's proposed labels against the human's final labels.
 * Returns which fields the user changed and whether the draft was confirmed
 * as-is or corrected. Pure — no I/O. (Rejections are set by the caller.)
 */
export function computeLabelEvent(
  model: Partial<LabelFields>,
  final: Partial<LabelFields>
): LabelEventComputation {
  const correctedFields = COMPARABLE_FIELDS.filter(
    (field) => norm(model[field]) !== norm(final[field])
  );
  return {
    eventType: correctedFields.length > 0 ? "corrected" : "confirmed",
    correctedFields,
  };
}

export type LabelEventRow = {
  user_id: string;
  draft_id: string;
  garment_id: string | null;
  source_id: string | null;
  event_type: "confirmed" | "corrected" | "rejected";
  corrected_fields: string[];
  source_storage_path: string | null;
  crop_path: string | null;
  bbox: number[] | null;
  crop_width: number | null;
  crop_height: number | null;
  model_category: string | null;
  model_colour: string | null;
  model_material: string | null;
  model_style: string | null;
  model_brand: string | null;
  model_confidence: number | null;
  model_field_confidence: Record<string, unknown> | null;
  final_category: string | null;
  final_colour: string | null;
  final_material: string | null;
  final_style: string | null;
  final_brand: string | null;
  final_title: string | null;
};

/**
 * Best-effort training-data capture. MUST NOT throw — a logging failure must
 * never break the user's accept/reject. Errors are logged and swallowed.
 * The `garment_label_events` table is not in the generated Database types yet,
 * so the insert payload is cast (matching the existing pattern in actions.ts).
 */
export async function recordLabelEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  row: LabelEventRow
): Promise<void> {
  try {
    const { error } = await supabase
      .from("garment_label_events")
      .insert(row as never);
    if (error) {
      console.error("recordLabelEvent insert failed:", error.message);
    }
  } catch (err) {
    console.error("recordLabelEvent threw:", err);
  }
}
