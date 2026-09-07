"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { confirmAge, declineAge, markSafetyBriefSeen, updateRadiusKm } from "@/lib/domain/profile/service";
import {
  addLocalListingPhoto,
  blockUser,
  cancelHandover,
  closeThreadForCancelledListing,
  confirmHandover,
  createLocalListing,
  listBlockedUsers,
  proposeHandover,
  reportListing,
  reportNoShow,
  respondToHandover,
  respondToOffer,
  sendMessage,
  startThread,
  unblockUser,
  withdrawLocalListing,
  withdrawOffer
} from "@/lib/domain/local-threads/threads-service";
import type { CreateLocalListingInput } from "@/lib/domain/local-threads";

type ActionResult = { status: "success" } | { status: "error"; message: string };

export async function createLocalListingAction(
  input: CreateLocalListingInput
): Promise<{ status: "success"; listingId: string } | { status: "error"; message: string }> {
  try {
    const listingId = await createLocalListing(input);
    revalidatePath("/local/nearby");
    revalidatePath("/wardrobe");
    return { status: "success", listingId };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to list this piece."
    };
  }
}

export async function addLocalListingPhotoAction(
  garmentId: string,
  file: File
): Promise<{ status: "success"; path: string } | { status: "error"; message: string }> {
  try {
    const path = await addLocalListingPhoto({ garmentId, file });
    return { status: "success", path };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to upload that photo."
    };
  }
}

export async function withdrawLocalListingAction(listingId: string): Promise<ActionResult> {
  try {
    await withdrawLocalListing(listingId);
    revalidatePath("/local/nearby");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to withdraw the listing."
    };
  }
}

export async function startThreadAction(
  listingId: string,
  firstMessage: string
): Promise<void> {
  const threadId = await startThread(listingId, firstMessage);
  revalidatePath("/local/threads");
  redirect(`/local/threads/${threadId}`);
}

export async function sendMessageAction(
  threadId: string,
  input: { body?: string; offerCents?: number }
): Promise<ActionResult> {
  try {
    await sendMessage(threadId, input);
    revalidatePath(`/local/threads/${threadId}`);
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to send that."
    };
  }
}

export async function proposeHandoverAction(
  threadId: string,
  input: { placeName: string; placeSuburb: string; placeNote?: string | null; at: string }
): Promise<ActionResult> {
  try {
    await proposeHandover(threadId, input);
    revalidatePath(`/local/threads/${threadId}`);
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to propose a handover."
    };
  }
}

export async function respondToHandoverAction(
  handoverId: string,
  threadId: string,
  response: "agree" | "decline"
): Promise<ActionResult> {
  try {
    await respondToHandover(handoverId, response);
    revalidatePath(`/local/threads/${threadId}`);
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to respond."
    };
  }
}

export async function confirmHandoverAction(
  handoverId: string,
  threadId: string,
  paymentMethod?: "cash" | "payid" | "bank transfer"
): Promise<ActionResult> {
  try {
    await confirmHandover(handoverId, paymentMethod);
    revalidatePath(`/local/threads/${threadId}`);
    revalidatePath("/wardrobe");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to confirm the handover."
    };
  }
}

export async function blockUserAction(userId: string, threadId?: string): Promise<ActionResult> {
  try {
    await blockUser(userId);
    if (threadId) revalidatePath(`/local/threads/${threadId}`);
    revalidatePath("/local/nearby");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to block this user."
    };
  }
}

export async function unblockUserAction(userId: string): Promise<ActionResult> {
  try {
    await unblockUser(userId);
    revalidatePath("/local/nearby");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to unblock this user."
    };
  }
}

export async function reportListingAction(listingId: string, reason: string): Promise<ActionResult> {
  try {
    await reportListing(listingId, reason);
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to send the report."
    };
  }
}

export async function respondToOfferAction(messageId: string, threadId: string): Promise<ActionResult> {
  try {
    await respondToOffer(messageId);
    revalidatePath(`/local/threads/${threadId}`);
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to decline that offer."
    };
  }
}

export async function withdrawOfferAction(messageId: string, threadId: string): Promise<ActionResult> {
  try {
    await withdrawOffer(messageId);
    revalidatePath(`/local/threads/${threadId}`);
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to withdraw that offer."
    };
  }
}

export async function cancelHandoverAction(handoverId: string, threadId: string): Promise<ActionResult> {
  try {
    await cancelHandover(handoverId);
    revalidatePath(`/local/threads/${threadId}`);
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to cancel the handover."
    };
  }
}

export async function reportNoShowAction(handoverId: string, threadId: string): Promise<ActionResult> {
  try {
    await reportNoShow(handoverId);
    revalidatePath(`/local/threads/${threadId}`);
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to record that."
    };
  }
}

export async function cancelListingAction(listingId: string, threadIdToClose?: string): Promise<ActionResult> {
  try {
    await withdrawLocalListing(listingId);
    if (threadIdToClose) {
      await closeThreadForCancelledListing(threadIdToClose, listingId);
    }
    revalidatePath(`/local/${listingId}`);
    revalidatePath("/local/nearby");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to cancel the listing."
    };
  }
}

export async function listBlockedUsersAction(): Promise<
  Array<{ userId: string; localName: string | null; blockedAt: string }>
> {
  return listBlockedUsers();
}

export async function markSafetyBriefSeenAction(): Promise<void> {
  await markSafetyBriefSeen();
}

export async function confirmAgeAction(): Promise<void> {
  await confirmAge();
}

export async function declineAgeAction(): Promise<void> {
  await declineAge();
}

export async function updateRadiusAction(
  radiusKm: number
): Promise<{ status: "success" } | { status: "error"; message: string }> {
  try {
    await updateRadiusKm(radiusKm);
    revalidatePath("/local/nearby");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save the radius."
    };
  }
}
