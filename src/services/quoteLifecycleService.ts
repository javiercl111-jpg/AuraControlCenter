import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../config/firebase";
import type { QuoteStatus } from "../types/quote";

const COLLECTION_NAME = "platform_quotes";

export async function updateQuoteStatus(
  quoteId: string,
  status: QuoteStatus,
  options?: {
    rejectionReason?: string;
  }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (status === "SENT") {
    updatePayload.sentAt = serverTimestamp();
  }

  if (status === "ACCEPTED") {
    updatePayload.acceptedAt = serverTimestamp();
  }

  if (status === "REJECTED") {
    updatePayload.rejectedAt = serverTimestamp();
    updatePayload.rejectionReason = options?.rejectionReason || "";
  }

  if (status === "EXPIRED") {
    updatePayload.expiredAt = serverTimestamp();
  }

  await updateDoc(doc(db, COLLECTION_NAME, quoteId), updatePayload);
}

export async function markQuoteAsSent(quoteId: string): Promise<void> {
  await updateQuoteStatus(quoteId, "SENT");
}

export async function acceptQuote(quoteId: string): Promise<void> {
  await updateQuoteStatus(quoteId, "ACCEPTED");
}

export async function rejectQuote(
  quoteId: string,
  rejectionReason = ""
): Promise<void> {
  await updateQuoteStatus(quoteId, "REJECTED", { rejectionReason });
}