import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { provisionAcceptedQuote } from "./provisioningService";
import { generateCommissionFromQuote } from "./commissionEngineService";
import type { PlatformQuote, QuoteStatus } from "../types/quote";

const COLLECTION_NAME = "platform_quotes";

/**
 * Updates the basic status and timestamp of a quote in Firestore.
 */
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

/**
 * Marks a quote as SENT.
 */
export async function markQuoteAsSent(quoteId: string): Promise<void> {
  await updateQuoteStatus(quoteId, "SENT");
}

/**
 * Helper to execute the provisioning flow for a quote that is in ACCEPTED status.
 */
async function executeProvisioning(quoteId: string): Promise<void> {
  // 1. Fetch the fresh quote from Firestore
  const quoteRef = doc(db, COLLECTION_NAME, quoteId);
  const quoteDoc = await getDoc(quoteRef);

  if (!quoteDoc.exists()) {
    throw new Error("La propuesta comercial no existe.");
  }

  const freshQuote = {
    id: quoteDoc.id,
    ...quoteDoc.data(),
  } as PlatformQuote;

  try {
    // 2. Call the provisioning service
    const result = await provisionAcceptedQuote(freshQuote);

    // 3. Update the quote with provisioning info upon success
    await updateDoc(quoteRef, {
      provisioningStatus: "READY",
      provisioningJobId: result.provisioningJobId,
      clientId: result.clientId,
      tenantId: result.tenantId,
      subscriptionId: result.subscriptionId,
      licenseIds: result.licenseIds,
      provisionedAt: serverTimestamp(),
      provisioningErrorMessage: null,
      updatedAt: serverTimestamp(),
    });

    // 3b. Generate commission for the sales advisor
    try {
      const commResult = await generateCommissionFromQuote(quoteId);
      if (commResult.skipped) {
        await updateDoc(quoteRef, {
          commissionSkipped: true,
          commissionSkipReason: commResult.reason || "DIRECT_SALE_NO_ADVISOR",
          commissionGenerated: false,
          commissionErrorMessage: null,
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(quoteRef, {
          commissionGenerated: true,
          commissionSkipped: false,
          commissionId: commResult.commissionId,
          commissionErrorMessage: null,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (commError) {
      console.error("Fallo al generar la comisión del asesor comercial:", commError);
      const errorMessage = commError instanceof Error ? commError.message : "Error al generar la comisión.";
      await updateDoc(quoteRef, {
        commissionErrorMessage: errorMessage,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    // 4. Update the quote with failure details upon error
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido en aprovisionamiento.";

    await updateDoc(quoteRef, {
      provisioningStatus: "FAILED",
      provisioningErrorMessage: errorMessage,
      updatedAt: serverTimestamp(),
    });

    throw error;
  }
}

/**
 * Accepts a quote and triggers auto provisioning.
 */
export async function acceptQuote(quoteId: string): Promise<void> {
  // 1. First, transition quote to ACCEPTED status
  await updateQuoteStatus(quoteId, "ACCEPTED");

  // 2. Run the provisioning flow
  await executeProvisioning(quoteId);
}

/**
 * Retries a failed provisioning job for an accepted quote.
 */
export async function retryProvisioning(quoteId: string): Promise<void> {
  await executeProvisioning(quoteId);
}

/**
 * Rejects a quote.
 */
export async function rejectQuote(
  quoteId: string,
  rejectionReason = ""
): Promise<void> {
  await updateQuoteStatus(quoteId, "REJECTED", { rejectionReason });
}

// Global rule: all files must end with a default export.
const quoteLifecycleService = {
  updateQuoteStatus,
  markQuoteAsSent,
  acceptQuote,
  retryProvisioning,
  rejectQuote,
};

export default quoteLifecycleService;