import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOrCreateProfile } from "@/lib/domain/profile/service";
import { getGarmentById } from "@/lib/domain/wardrobe/service";
import { createLocalListingInputSchema, type CreateLocalListingInput } from "@/lib/domain/local-threads";
import type { TablesInsert, TablesUpdate } from "@/types/database";

type ThreadInsert = TablesInsert<"threads">;
type MessageInsert = TablesInsert<"messages">;
type HandoverInsert = TablesInsert<"handovers">;
type HandoverUpdate = TablesUpdate<"handovers">;
type LocalListingInsert = TablesInsert<"local_listings">;

/** 16c / w2c — list it locally, photos pre-picked from the piece's own images. */
export async function createLocalListing(input: CreateLocalListingInput): Promise<string> {
  const user = await getRequiredUser();
  await checkRateLimit("local-listing-create", 10, 3600);
  const supabase = await createClient();
  const parsed = createLocalListingInputSchema.parse(input);

  const garment = await getGarmentById(parsed.garment_id);
  if (!garment || garment.user_id !== user.id) {
    throw new Error("Piece not found.");
  }

  const profile = await getOrCreateProfile();
  if (profile.age_declined_at) {
    throw new Error("Local threads needs an adult. This stays off for this account.");
  }
  if (profile.suburb_lat === null || profile.suburb_lng === null) {
    throw new Error("Set your suburb in your account before listing locally.");
  }

  // Photos default to the piece's own images — cutout first. This repo has
  // no separate "look photo" capture (5a/5b) to pull lookbook photos from,
  // so photo_uris is the piece's garment_images only, not yet the fuller
  // "lookbook photos the piece appears in" DATA_MODEL describes.
  const photoUris =
    parsed.photo_uris.length > 0
      ? parsed.photo_uris
      : [...garment.images]
          .sort((a, b) => (a.image_type === "cutout" ? -1 : b.image_type === "cutout" ? 1 : 0))
          .map((image) => image.storage_path);

  const insert: LocalListingInsert = {
    piece_id: parsed.garment_id,
    seller_id: user.id,
    status: "live",
    ask_cents: parsed.ask_cents,
    negotiable: parsed.negotiable,
    description: parsed.description,
    category: garment.category,
    subcategory: garment.subcategory ?? null,
    photo_uris: photoUris,
    show_wear_count: parsed.show_wear_count,
    wear_count_at_listing: garment.wear_count,
    size: parsed.size ?? garment.size ?? null,
    suburb: profile.suburb ?? "",
    lat: profile.suburb_lat,
    lng: profile.suburb_lng,
    listed_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("local_listings")
    .insert(insert as never)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create the listing.");
  }

  // Creating a listing does not remove the piece from the wardrobe — it
  // stays and counts, only becoming 'listed for sale'.
  await supabase
    .from("garments")
    .update({ availability: "listed for sale" } as never)
    .eq("id", parsed.garment_id)
    .eq("user_id", user.id);

  return (data as { id: string }).id;
}

export async function withdrawLocalListing(listingId: string): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(listingId);

  const { data: listing } = await supabase
    .from("local_listings")
    .select("piece_id")
    .eq("id", parsedId)
    .eq("seller_id", user.id)
    .maybeSingle();

  await supabase
    .from("local_listings")
    .update({ status: "withdrawn" } as never)
    .eq("id", parsedId)
    .eq("seller_id", user.id);

  if (listing) {
    await supabase
      .from("garments")
      .update({ availability: "wearable" } as never)
      .eq("id", (listing as { piece_id: string }).piece_id)
      .eq("user_id", user.id);
  }
}

/** 16d / w2d — one thread per buyer per listing. */
export async function startThread(listingId: string, firstMessage: string): Promise<string> {
  const user = await getRequiredUser();
  await checkRateLimit("local-thread-start", 20, 3600);
  const supabase = await createClient();
  const parsedListingId = z.string().uuid().parse(listingId);
  const parsedMessage = z.string().trim().min(1).max(2000).parse(firstMessage);

  const { data: listing, error: listingError } = await supabase
    .from("local_listings")
    .select("id,seller_id,status")
    .eq("id", parsedListingId)
    .maybeSingle();

  if (listingError || !listing) {
    throw new Error("Listing not found.");
  }

  const parsedListing = listing as { id: string; seller_id: string; status: string };
  if (parsedListing.status !== "live") {
    throw new Error("This listing is no longer live.");
  }
  if (parsedListing.seller_id === user.id) {
    throw new Error("You can't message yourself about your own listing.");
  }

  const threadInsert: ThreadInsert = {
    listing_id: parsedListingId,
    buyer_id: user.id,
    seller_id: parsedListing.seller_id
  };

  const { data: thread, error: threadError } = await supabase
    .from("threads")
    .insert(threadInsert as never)
    .select("id")
    .single();

  if (threadError || !thread) {
    throw new Error(threadError?.message ?? "Unable to start the conversation.");
  }

  const threadId = (thread as { id: string }).id;
  await insertMessage(supabase, { threadId, senderId: user.id, kind: "text", body: parsedMessage });

  return threadId;
}

export async function sendMessage(
  threadId: string,
  input: { body?: string; offerCents?: number }
): Promise<void> {
  const user = await getRequiredUser();
  await checkRateLimit("local-thread-message", 60, 3600);
  const supabase = await createClient();
  const parsedThreadId = z.string().uuid().parse(threadId);

  if (input.offerCents !== undefined) {
    const offerCents = z.number().int().nonnegative().parse(input.offerCents);
    await insertMessage(supabase, {
      threadId: parsedThreadId,
      senderId: user.id,
      kind: "offer",
      body: input.body ?? "",
      offerCents
    });
    return;
  }

  const body = z.string().trim().min(1).max(2000).parse(input.body);
  await insertMessage(supabase, { threadId: parsedThreadId, senderId: user.id, kind: "text", body });
}

/**
 * 16b column, missing — seller declines a buyer's offer. Scoped to the
 * *other* party's message: a seller can decline any pending offer in a
 * thread they're party to, but never their own.
 */
export async function respondToOffer(messageId: string): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(messageId);

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("thread_id,sender_id,offer_cents")
    .eq("id", parsedId)
    .maybeSingle();

  if (messageError || !message) {
    throw new Error("Offer not found.");
  }

  const parsedMessage = message as { thread_id: string; sender_id: string; offer_cents: number | null };
  if (parsedMessage.sender_id === user.id) {
    throw new Error("You can't decline your own offer.");
  }

  const { error } = await supabase
    .from("messages")
    .update({ offer_status: "declined" } as never)
    .eq("id", parsedId);

  if (error) {
    throw new Error(error.message);
  }

  await insertMessage(supabase, {
    threadId: parsedMessage.thread_id,
    senderId: user.id,
    kind: "system",
    body: "offer declined"
  });
}

/**
 * 16b column, missing — buyer withdraws their own offer. Scoped to the
 * sender: only the person who made the offer can withdraw it.
 */
export async function withdrawOffer(messageId: string): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(messageId);

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("thread_id,sender_id")
    .eq("id", parsedId)
    .maybeSingle();

  if (messageError || !message) {
    throw new Error("Offer not found.");
  }

  const parsedMessage = message as { thread_id: string; sender_id: string };
  if (parsedMessage.sender_id !== user.id) {
    throw new Error("You can only withdraw your own offer.");
  }

  const { error } = await supabase
    .from("messages")
    .update({ offer_status: "withdrawn" } as never)
    .eq("id", parsedId);

  if (error) {
    throw new Error(error.message);
  }

  await insertMessage(supabase, {
    threadId: parsedMessage.thread_id,
    senderId: user.id,
    kind: "system",
    body: "offer withdrawn"
  });
}

async function insertMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: { threadId: string; senderId: string; kind: "text" | "offer" | "handover proposal" | "system"; body: string; offerCents?: number }
) {
  const insert: MessageInsert = {
    thread_id: params.threadId,
    sender_id: params.senderId,
    kind: params.kind,
    body: params.body,
    offer_cents: params.offerCents ?? null
  };

  const { error } = await supabase.from("messages").insert(insert as never);
  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from("threads")
    .update({ last_message_at: new Date().toISOString() } as never)
    .eq("id", params.threadId);

  const { data: thread } = await supabase
    .from("threads")
    .select("buyer_id,seller_id")
    .eq("id", params.threadId)
    .maybeSingle();

  if (thread) {
    const parsedThread = thread as { buyer_id: string; seller_id: string };
    const recipientId = parsedThread.buyer_id === params.senderId ? parsedThread.seller_id : parsedThread.buyer_id;
    const { createNotification } = await import("@/lib/domain/notifications/service");
    await createNotification({
      userId: recipientId,
      kind: "message",
      title: "New message",
      body: params.kind === "offer" ? `Offered A$${((params.offerCents ?? 0) / 100).toFixed(0)}` : params.body,
      subjectKind: "thread",
      subjectId: params.threadId
    });
  }
}

/** Public places only — the place list is a free-text field the two people agree on. */
export async function proposeHandover(
  threadId: string,
  input: { placeName: string; placeSuburb: string; placeNote?: string | null; at: string }
): Promise<void> {
  const user = await getRequiredUser();
  await checkRateLimit("local-handover-propose", 20, 3600);
  const supabase = await createClient();
  const parsedThreadId = z.string().uuid().parse(threadId);

  const insert: HandoverInsert = {
    thread_id: parsedThreadId,
    place_name: z.string().trim().min(1).max(160).parse(input.placeName),
    place_suburb: z.string().trim().min(1).max(120).parse(input.placeSuburb),
    place_note: input.placeNote?.trim() || null,
    at: z.string().datetime().parse(input.at),
    proposed_by: user.id
  };

  const { error } = await supabase.from("handovers").insert(insert as never);
  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from("threads")
    .update({ state: "handover arranged" } as never)
    .eq("id", parsedThreadId);

  await insertMessage(supabase, {
    threadId: parsedThreadId,
    senderId: user.id,
    kind: "handover proposal",
    body: `${insert.place_name}, ${insert.place_suburb} at ${new Date(insert.at).toLocaleString("en-AU")}`
  });
}

export async function respondToHandover(
  handoverId: string,
  response: "agree" | "decline"
): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(handoverId);

  const update: HandoverUpdate = { state: response === "agree" ? "agreed" : "cancelled" };
  const { error } = await supabase.from("handovers").update(update as never).eq("id", parsedId);
  if (error) {
    throw new Error(error.message);
  }

  if (response === "decline") {
    const { data: handover } = await supabase
      .from("handovers")
      .select("thread_id")
      .eq("id", parsedId)
      .maybeSingle();

    if (handover) {
      await supabase
        .from("threads")
        .update({ state: "open" } as never)
        .eq("id", (handover as { thread_id: string }).thread_id);
    }
  }

  void user; // action is scoped to participants by RLS, not by this check
}

const TERMINAL_HANDOVER_STATES = new Set(["completed", "cancelled", "missed"]);

/** Sheet action for "cancel or reschedule a handover" — either party can cancel. */
export async function cancelHandover(handoverId: string): Promise<void> {
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(handoverId);

  const { data: handover, error: handoverError } = await supabase
    .from("handovers")
    .select("thread_id,state")
    .eq("id", parsedId)
    .maybeSingle();

  if (handoverError || !handover) {
    throw new Error("Handover not found.");
  }

  const parsedHandover = handover as { thread_id: string; state: string };
  if (TERMINAL_HANDOVER_STATES.has(parsedHandover.state)) {
    throw new Error("This handover has already been cancelled.");
  }

  const { error } = await supabase
    .from("handovers")
    .update({ state: "cancelled" } as never)
    .eq("id", parsedId);

  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from("threads")
    .update({ state: "open" } as never)
    .eq("id", parsedHandover.thread_id);
}

/**
 * "they didn't show" — the only trust signal the marketplace has. Records
 * who was reported as a no-show (the *other* participant, never the
 * reporter) and reopens the thread so the pair can still try again.
 */
export async function reportNoShow(handoverId: string): Promise<void> {
  const user = await getRequiredUser();
  await checkRateLimit("local-handover-no-show", 10, 3600);
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(handoverId);

  const { data: handover, error: handoverError } = await supabase
    .from("handovers")
    .select("thread_id,state")
    .eq("id", parsedId)
    .maybeSingle();

  if (handoverError || !handover) {
    throw new Error("Handover not found.");
  }

  const parsedHandover = handover as { thread_id: string; state: string };
  if (TERMINAL_HANDOVER_STATES.has(parsedHandover.state)) {
    throw new Error("This handover was already resolved.");
  }

  const threadId = parsedHandover.thread_id;

  const { data: thread, error: threadError } = await supabase
    .from("threads")
    .select("buyer_id,seller_id")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError || !thread) {
    throw new Error("Thread not found.");
  }

  const parsedThread = thread as { buyer_id: string; seller_id: string };
  if (user.id !== parsedThread.buyer_id && user.id !== parsedThread.seller_id) {
    throw new Error("Not a participant in this handover.");
  }
  const noShowBy = user.id === parsedThread.buyer_id ? parsedThread.seller_id : parsedThread.buyer_id;

  const { error } = await supabase
    .from("handovers")
    .update({
      state: "missed",
      no_show_by: noShowBy,
      no_show_reported_at: new Date().toISOString()
    } as never)
    .eq("id", parsedId);

  if (error) {
    throw new Error(error.message);
  }

  await supabase.from("threads").update({ state: "open" } as never).eq("id", threadId);
}

/**
 * Both parties must confirm. On the second confirmation, complete_handover()
 * (migration 031) archives the piece, closes the thread and writes
 * sold_for — never a payment. paymentMethod is recorded as a label only.
 */
export async function confirmHandover(
  handoverId: string,
  paymentMethod?: "cash" | "payid" | "bank transfer"
): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(handoverId);

  const { data: handover, error: handoverError } = await supabase
    .from("handovers")
    .select("id,thread_id")
    .eq("id", parsedId)
    .maybeSingle();

  if (handoverError || !handover) {
    throw new Error("Handover not found.");
  }

  const { data: thread } = await supabase
    .from("threads")
    .select("buyer_id,seller_id")
    .eq("id", (handover as { thread_id: string }).thread_id)
    .maybeSingle();

  if (!thread) {
    throw new Error("Thread not found.");
  }

  const parsedThread = thread as { buyer_id: string; seller_id: string };
  const update: HandoverUpdate = {};
  if (user.id === parsedThread.buyer_id) update.buyer_confirmed = true;
  if (user.id === parsedThread.seller_id) update.seller_confirmed = true;
  if (paymentMethod) update.payment_method = paymentMethod;

  const { error } = await supabase.from("handovers").update(update as never).eq("id", parsedId);
  if (error) {
    throw new Error(error.message);
  }

  await supabase.rpc("complete_handover" as never, { p_handover_id: parsedId } as never);
}

export async function blockUser(userId: string): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(userId);

  const { error } = await supabase
    .from("user_blocks")
    .insert({ blocker_id: user.id, blocked_id: parsedId } as never);
  if (error) {
    throw new Error(error.message);
  }

  // Mutual and immediate: close any open threads between the two.
  await supabase
    .from("threads")
    .update({ state: "blocked" } as never)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .or(`buyer_id.eq.${parsedId},seller_id.eq.${parsedId}`);
}

export async function unblockUser(userId: string): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(userId);

  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", parsedId);
  if (error) {
    throw new Error(error.message);
  }
}

const messageSchema = z.object({
  id: z.string().uuid(),
  thread_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  kind: z.string(),
  body: z.string(),
  offer_cents: z.number().int().nullable(),
  offer_status: z.enum(["pending", "accepted", "declined", "withdrawn"]).nullable(),
  sent_at: z.string(),
  read_at: z.string().nullable()
});
export type ThreadMessage = z.infer<typeof messageSchema>;

const handoverSchema = z.object({
  id: z.string().uuid(),
  thread_id: z.string().uuid(),
  place_name: z.string(),
  place_suburb: z.string(),
  place_note: z.string().nullable(),
  at: z.string(),
  proposed_by: z.string().uuid(),
  state: z.string(),
  payment_method: z.string().nullable(),
  completed_at: z.string().nullable(),
  seller_confirmed: z.boolean(),
  buyer_confirmed: z.boolean(),
  no_show_by: z.string().uuid().nullable(),
  no_show_reported_at: z.string().nullable()
});
export type ThreadHandover = z.infer<typeof handoverSchema>;

const threadSchema = z.object({
  id: z.string().uuid(),
  listing_id: z.string().uuid(),
  buyer_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  state: z.string(),
  last_message_at: z.string(),
  created_at: z.string()
});
export type Thread = z.infer<typeof threadSchema>;

export async function listMyThreads(): Promise<Thread[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("threads")
    .select("id,listing_id,buyer_id,seller_id,state,last_message_at,created_at")
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(threadSchema).parse(data ?? []);
}

export async function getThreadDetail(threadId: string): Promise<{
  thread: Thread;
  messages: ThreadMessage[];
  handover: ThreadHandover | null;
} | null> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(threadId);

  const { data: threadRow, error: threadError } = await supabase
    .from("threads")
    .select("id,listing_id,buyer_id,seller_id,state,last_message_at,created_at")
    .eq("id", parsedId)
    .maybeSingle();

  if (threadError) throw new Error(threadError.message);
  if (!threadRow) return null;

  const thread = threadSchema.parse(threadRow);
  if (thread.buyer_id !== user.id && thread.seller_id !== user.id) {
    return null;
  }

  const { data: messageRows, error: messagesError } = await supabase
    .from("messages")
    .select("id,thread_id,sender_id,kind,body,offer_cents,offer_status,sent_at,read_at")
    .eq("thread_id", parsedId)
    .order("sent_at", { ascending: true });

  if (messagesError) throw new Error(messagesError.message);

  const { data: handoverRow } = await supabase
    .from("handovers")
    .select(
      "id,thread_id,place_name,place_suburb,place_note,at,proposed_by,state,payment_method,completed_at,seller_confirmed,buyer_confirmed"
    )
    .eq("thread_id", parsedId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    thread,
    messages: z.array(messageSchema).parse(messageRows ?? []),
    handover: handoverRow ? handoverSchema.parse(handoverRow) : null
  };
}

/**
 * "cancel a listing with a live offer" reads this before showing the
 * dialog. A pending offer is any kind='offer' message with offer_status
 * 'pending' in a thread on this listing; a live handover is any handover
 * not yet completed/cancelled/missed.
 */
export async function hasLiveOfferOrHandover(
  listingId: string
): Promise<{ hasOffer: boolean; hasHandover: boolean; counterpartUserId: string | null }> {
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(listingId);

  const { data: threads, error: threadsError } = await supabase
    .from("threads")
    .select("id,buyer_id")
    .eq("listing_id", parsedId);

  if (threadsError) {
    throw new Error(threadsError.message);
  }

  const threadRows = (threads ?? []) as Array<{ id: string; buyer_id: string }>;
  if (threadRows.length === 0) {
    return { hasOffer: false, hasHandover: false, counterpartUserId: null };
  }

  const threadIds = threadRows.map((thread) => thread.id);

  const { data: offers } = await supabase
    .from("messages")
    .select("thread_id")
    .in("thread_id", threadIds)
    .eq("kind", "offer")
    .eq("offer_status", "pending");

  const { data: handovers } = await supabase
    .from("handovers")
    .select("thread_id")
    .in("thread_id", threadIds)
    .in("state", ["proposed", "agreed"]);

  const offerThreadId = (offers as Array<{ thread_id: string }> | null)?.[0]?.thread_id ?? null;
  const handoverThreadId = (handovers as Array<{ thread_id: string }> | null)?.[0]?.thread_id ?? null;
  const matchedThreadId = handoverThreadId ?? offerThreadId;
  const counterpart = threadRows.find((thread) => thread.id === matchedThreadId);

  return {
    hasOffer: Boolean(offerThreadId),
    hasHandover: Boolean(handoverThreadId),
    counterpartUserId: counterpart?.buyer_id ?? null
  };
}

/** Closes a thread once its listing has been cancelled out from under it. */
export async function closeThreadForCancelledListing(threadId: string): Promise<void> {
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(threadId);

  const { error } = await supabase
    .from("threads")
    .update({ state: "declined" } as never)
    .eq("id", parsedId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Account page's "blocked · N people" list — RLS already scopes this to
 * the caller's own rows. `blocked_id` and `profiles.user_id` share a
 * common parent (auth.users) but no direct foreign key, so PostgREST can't
 * embed this as a single query — two plain queries, joined in code.
 * profiles_select_via_block (migration 037) is what makes the second
 * query return anything at all.
 */
export async function listBlockedUsers(): Promise<
  Array<{ userId: string; localName: string | null; blockedAt: string }>
> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data: blocks, error: blocksError } = await supabase
    .from("user_blocks")
    .select("blocked_id,created_at")
    .eq("blocker_id", user.id)
    .order("created_at", { ascending: false });

  if (blocksError) {
    throw new Error(blocksError.message);
  }

  const blockRows = (blocks ?? []) as Array<{ blocked_id: string; created_at: string }>;
  if (blockRows.length === 0) {
    return [];
  }

  const blockedIds = blockRows.map((row) => row.blocked_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id,local_name")
    .in("user_id", blockedIds);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profileRows = (profiles ?? []) as Array<{ user_id: string; local_name: string | null }>;
  const localNameByUserId = new Map(profileRows.map((row) => [row.user_id, row.local_name]));

  return blockRows.map((row) => ({
    userId: row.blocked_id,
    localName: localNameByUserId.get(row.blocked_id) ?? null,
    blockedAt: row.created_at
  }));
}

export async function reportListing(listingId: string, reason: string): Promise<void> {
  const user = await getRequiredUser();
  await checkRateLimit("local-listing-report", 10, 3600);
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(listingId);
  const parsedReason = z.string().trim().min(1).max(500).parse(reason);

  const { error } = await supabase
    .from("listing_reports")
    .insert({ listing_id: parsedId, reporter_id: user.id, reason: parsedReason } as never);
  if (error) {
    throw new Error(error.message);
  }
}
