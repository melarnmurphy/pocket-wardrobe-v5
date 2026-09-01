import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";

/**
 * "There are no retailer account connections anywhere in the product."
 * A retailer here is a string parsed off a receipt, never a connection —
 * see DATA_MODEL.md "Sources, receipts".
 */
export const RECEIPT_LIKE_SOURCE_TYPES = [
  "receipt",
  "forwarded_email",
  "read_email",
  "docket_photo",
  "pdf",
  "screenshot"
] as const;

const receiptSourceSchema = z.object({
  id: z.string().uuid(),
  source_type: z.string(),
  created_at: z.string(),
  parse_status: z.string(),
  garment_drafts: z.array(
    z.object({
      id: z.string().uuid(),
      status: z.string(),
      draft_payload_json: z.record(z.string(), z.unknown()).nullable()
    })
  )
});

export type ReceiptSource = {
  id: string;
  sourceType: string;
  createdAt: string;
  parseStatus: string;
  retailer: string | null;
  totalDrafts: number;
  pendingDrafts: number;
};

/** 10a / 15b / 13a — receipts grouped by retailer, and how the price got read. */
export async function listReceiptSources(): Promise<ReceiptSource[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("garment_sources")
    .select("id,source_type,created_at,parse_status,garment_drafts(id,status,draft_payload_json)")
    .eq("user_id", user.id)
    .in("source_type", RECEIPT_LIKE_SOURCE_TYPES as unknown as string[])
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = z.array(receiptSourceSchema).parse(data ?? []);

  return rows.map((row) => {
    const retailer = row.garment_drafts
      .map((draft) => draft.draft_payload_json?.retailer)
      .find((value): value is string => typeof value === "string" && value.length > 0);

    return {
      id: row.id,
      sourceType: row.source_type,
      createdAt: row.created_at,
      parseStatus: row.parse_status,
      retailer: retailer ?? null,
      totalDrafts: row.garment_drafts.length,
      pendingDrafts: row.garment_drafts.filter((draft) => draft.status === "pending").length
    };
  });
}

const SOURCE_TYPE_LABEL: Record<string, string> = {
  receipt: "receipt",
  forwarded_email: "forwarded email",
  read_email: "read from your inbox",
  docket_photo: "docket photo",
  pdf: "pdf",
  screenshot: "screenshot"
};

export function sourceTypeLabel(sourceType: string): string {
  return SOURCE_TYPE_LABEL[sourceType] ?? sourceType;
}

/**
 * The forwarding address shown on 10a/15b. Decoded directly from the local
 * part by the inbound webhook (see app/api/receipts/inbound/route.ts) — no
 * lookup table needed. The domain is a placeholder until a real
 * inbound-email provider is chosen and connected.
 */
export function forwardingAddressFor(userId: string): string {
  return `u-${userId}@receipts.garderobe.app`;
}
