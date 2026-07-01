import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  addDoc,
  updateDoc,
  orderBy,
} from "firebase/firestore";

import { db } from "../config/firebase";
import type { PlatformQuote } from "../types/quote";
import type {
  PlatformCommission,
  CommissionStatus,
  CommissionGenerationResult,
} from "../types/commission";

const COMMISSIONS_COLLECTION = "platform_commissions";

/**
 * Fetches all commissions ordered by creation date descending.
 */
export async function getCommissions(): Promise<PlatformCommission[]> {
  const q = query(
    collection(db, COMMISSIONS_COLLECTION),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as PlatformCommission[];
}

/**
 * Updates the status of a commission.
 */
export async function updateCommissionStatus(
  commissionId: string,
  status: CommissionStatus
): Promise<void> {
  const payload: Record<string, any> = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (status === "PAID") {
    payload.paidAt = new Date().toISOString().slice(0, 10);
  }

  await updateDoc(doc(db, COMMISSIONS_COLLECTION, commissionId), payload);
}

/**
 * Adds or updates notes on a commission.
 */
export async function addCommissionNotes(
  commissionId: string,
  notes: string
): Promise<void> {
  await updateDoc(doc(db, COMMISSIONS_COLLECTION, commissionId), {
    notes,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Generates a commission from an accepted quote.
 * Performs lookup for idempotency.
 */
export async function generateCommissionFromQuote(
  quoteId: string
): Promise<CommissionGenerationResult> {
  // 1. Fetch Quote
  const quoteRef = doc(db, "platform_quotes", quoteId);
  const quoteSnap = await getDoc(quoteRef);
  if (!quoteSnap.exists()) {
    throw new Error(`La cotización con ID ${quoteId} no existe.`);
  }
  const quote = { id: quoteSnap.id, ...quoteSnap.data() } as PlatformQuote;

  // 2. Idempotency Check: check if commission already exists for this quoteId
  const existingQuery = query(
    collection(db, COMMISSIONS_COLLECTION),
    where("quoteId", "==", quoteId),
    limit(1)
  );
  const existingSnap = await getDocs(existingQuery);

  if (!existingSnap.empty) {
    const docData = existingSnap.docs[0];
    return {
      generated: false,
      skipped: true,
      reason: "COMMISSION_ALREADY_EXISTS",
      commissionId: docData.id,
    };
  }

  // 3. Inspect advisorId. If missing, null, empty or equal to "UNASSIGNED", skip commission safely.
  const advisorId = quote.advisorId;
  if (!advisorId || advisorId.trim() === "" || advisorId === "UNASSIGNED") {
    await updateDoc(quoteRef, {
      salesChannel: "DIRECT",
      commissionSkipped: true,
      commissionSkipReason: "DIRECT_SALE_NO_ADVISOR",
      commissionGenerated: false,
      updatedAt: serverTimestamp(),
    });

    return {
      generated: false,
      skipped: true,
      reason: "DIRECT_SALE_NO_ADVISOR",
    };
  }

  // 4. Fetch Client & Tenant to verify IDs
  let clientId = quote.clientId || "";
  let tenantId = quote.tenantId || "";

  if (!clientId) {
    const clientSnap = await getDocs(
      query(collection(db, "platform_clients"), where("quoteId", "==", quoteId), limit(1))
    );
    if (!clientSnap.empty) {
      clientId = clientSnap.docs[0].id;
    }
  }

  if (!tenantId) {
    const tenantSnap = await getDocs(
      query(collection(db, "platform_tenants"), where("quoteId", "==", quoteId), limit(1))
    );
    if (!tenantSnap.empty) {
      tenantId = tenantSnap.docs[0].id;
    }
  }

  // 5. Calculate Commission
  const saleAmount = quote.firstPaymentTotal || quote.total || 0;
  const setupFee = quote.setupFee || 0;
  const commissionPercent = 10;
  const commissionAmount = Number((saleAmount * (commissionPercent / 100)).toFixed(2));
  const advisorName = quote.advisorName || "Asesor General";

  // 6. Save Commission
  const commRef = await addDoc(collection(db, COMMISSIONS_COLLECTION), {
    quoteId,
    clientId,
    tenantId,
    advisorId,
    advisorName,
    commissionType: "NEW_SALE",
    commissionPercent,
    commissionAmount,
    saleAmount,
    setupFee,
    billingCycle: quote.billingCycle || "MONTHLY",
    status: "PENDING",
    notes: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    paidAt: null,
  });

  // 7. Update Quote with advisor status and generated ID
  await updateDoc(quoteRef, {
    salesChannel: "ADVISOR",
    commissionGenerated: true,
    commissionSkipped: false,
    commissionId: commRef.id,
    updatedAt: serverTimestamp(),
  });

  return {
    generated: true,
    skipped: false,
    commissionId: commRef.id,
  };
}

const commissionEngineService = {
  getCommissions,
  updateCommissionStatus,
  addCommissionNotes,
  generateCommissionFromQuote,
};

export default commissionEngineService;
