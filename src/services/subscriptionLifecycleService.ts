import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../config/firebase";
import type { PlatformSubscription } from "../types/subscription";

/**
 * Adds a specific number of days to today's date and returns a YYYY-MM-DD string.
 */
function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Helper to fetch a fresh subscription by ID.
 */
async function fetchSubscriptionDoc(subscriptionId: string) {
  const subRef = doc(db, "platform_subscriptions", subscriptionId);
  const snap = await getDoc(subRef);
  if (!snap.exists()) {
    throw new Error(`Suscripción con ID ${subscriptionId} no encontrada.`);
  }
  return { ref: subRef, data: snap.data() as Omit<PlatformSubscription, "id"> };
}

/**
 * Activates a subscription.
 * Updates subscription, tenant, and licenses to ACTIVE.
 */
export async function activateSubscription(subscriptionId: string): Promise<void> {
  const { ref: subRef, data: sub } = await fetchSubscriptionDoc(subscriptionId);
  const batch = writeBatch(db);

  const billingCycle = sub.billingCycle || "MONTHLY";
  const daysToAdd = billingCycle === "YEARLY" ? 365 : 30;
  const nextBilling = addDays(daysToAdd);

  // Update subscription
  batch.update(subRef, {
    status: "ACTIVE",
    activatedAt: serverTimestamp(),
    nextBillingDate: nextBilling,
    gracePeriodEndDate: null,
    suspendedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    updatedAt: serverTimestamp(),
  });

  // Update tenant
  if (sub.tenantId) {
    const tenantRef = doc(db, "platform_tenants", sub.tenantId);
    batch.update(tenantRef, {
      status: "ACTIVE",
      licenseStatus: "ACTIVE",
      updatedAt: serverTimestamp(),
    });
  }

  // Update client
  if (sub.clientId) {
    const clientRef = doc(db, "platform_clients", sub.clientId);
    batch.update(clientRef, {
      status: "ACTIVE",
      updatedAt: serverTimestamp(),
    });
  }

  // Update licenses
  const licQuery = query(
    collection(db, "platform_licenses"),
    where("subscriptionId", "==", subscriptionId)
  );
  const licSnap = await getDocs(licQuery);
  licSnap.docs.forEach((licDoc) => {
    batch.update(licDoc.ref, {
      status: "ACTIVE",
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

/**
 * Moves subscription to GRACE_PERIOD status.
 * Updates subscription and tenant to GRACE_PERIOD. Licenses remain ACTIVE.
 */
export async function moveToGracePeriod(subscriptionId: string): Promise<void> {
  const { ref: subRef, data: sub } = await fetchSubscriptionDoc(subscriptionId);
  const batch = writeBatch(db);
  const graceEndDate = addDays(30);

  // Update subscription
  batch.update(subRef, {
    status: "GRACE_PERIOD",
    gracePeriodEndDate: graceEndDate,
    updatedAt: serverTimestamp(),
  });

  // Update tenant
  if (sub.tenantId) {
    const tenantRef = doc(db, "platform_tenants", sub.tenantId);
    batch.update(tenantRef, {
      status: "GRACE_PERIOD",
      licenseStatus: "GRACE_PERIOD",
      updatedAt: serverTimestamp(),
    });
  }

  // Update client
  if (sub.clientId) {
    const clientRef = doc(db, "platform_clients", sub.clientId);
    batch.update(clientRef, {
      status: "GRACE_PERIOD",
      updatedAt: serverTimestamp(),
    });
  }

  // Update licenses (licenses remain ACTIVE)
  const licQuery = query(
    collection(db, "platform_licenses"),
    where("subscriptionId", "==", subscriptionId)
  );
  const licSnap = await getDocs(licQuery);
  licSnap.docs.forEach((licDoc) => {
    batch.update(licDoc.ref, {
      status: "ACTIVE",
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

/**
 * Suspends a subscription.
 * Updates subscription, tenant, and licenses to SUSPENDED.
 */
export async function suspendSubscription(subscriptionId: string): Promise<void> {
  const { ref: subRef, data: sub } = await fetchSubscriptionDoc(subscriptionId);
  const batch = writeBatch(db);

  // Update subscription
  batch.update(subRef, {
    status: "SUSPENDED",
    suspendedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Update tenant
  if (sub.tenantId) {
    const tenantRef = doc(db, "platform_tenants", sub.tenantId);
    batch.update(tenantRef, {
      status: "SUSPENDED",
      licenseStatus: "SUSPENDED",
      updatedAt: serverTimestamp(),
    });
  }

  // Update client
  if (sub.clientId) {
    const clientRef = doc(db, "platform_clients", sub.clientId);
    batch.update(clientRef, {
      status: "SUSPENDED",
      updatedAt: serverTimestamp(),
    });
  }

  // Update licenses to SUSPENDED
  const licQuery = query(
    collection(db, "platform_licenses"),
    where("subscriptionId", "==", subscriptionId)
  );
  const licSnap = await getDocs(licQuery);
  licSnap.docs.forEach((licDoc) => {
    batch.update(licDoc.ref, {
      status: "SUSPENDED",
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

/**
 * Cancels a subscription with a reason.
 * Updates subscription, tenant, and licenses to CANCELLED.
 */
export async function cancelSubscription(
  subscriptionId: string,
  reason: string
): Promise<void> {
  const { ref: subRef, data: sub } = await fetchSubscriptionDoc(subscriptionId);
  const batch = writeBatch(db);

  // Update subscription
  batch.update(subRef, {
    status: "CANCELLED",
    cancelledAt: serverTimestamp(),
    cancellationReason: reason || "No especificado",
    updatedAt: serverTimestamp(),
  });

  // Update tenant
  if (sub.tenantId) {
    const tenantRef = doc(db, "platform_tenants", sub.tenantId);
    batch.update(tenantRef, {
      status: "CANCELLED",
      licenseStatus: "CANCELLED",
      updatedAt: serverTimestamp(),
    });
  }

  // Update client
  if (sub.clientId) {
    const clientRef = doc(db, "platform_clients", sub.clientId);
    batch.update(clientRef, {
      status: "CANCELLED",
      updatedAt: serverTimestamp(),
    });
  }

  // Update licenses to CANCELLED
  const licQuery = query(
    collection(db, "platform_licenses"),
    where("subscriptionId", "==", subscriptionId)
  );
  const licSnap = await getDocs(licQuery);
  licSnap.docs.forEach((licDoc) => {
    batch.update(licDoc.ref, {
      status: "CANCELLED",
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

/**
 * Retrieves all subscriptions ordered by creation date descending.
 */
export async function getSubscriptions(): Promise<PlatformSubscription[]> {
  const q = query(
    collection(db, "platform_subscriptions"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as PlatformSubscription[];
}

const subscriptionLifecycleService = {
  activateSubscription,
  moveToGracePeriod,
  suspendSubscription,
  cancelSubscription,
  getSubscriptions,
};

export default subscriptionLifecycleService;
