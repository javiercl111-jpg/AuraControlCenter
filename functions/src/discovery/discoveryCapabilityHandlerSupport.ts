import * as functions from "firebase-functions";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getFunctions } from "firebase-admin/functions";

import {
  DiscoveryCapabilityError,
  hashDiscoveryCapabilityToken,
  type DiscoveryCompletionRecordV1,
} from "./capabilities";
import { DISCOVERY_COMPLETION_OUTBOX_COLLECTION } from
  "../infrastructure/firestore/discoveryCapabilities";

export function toDiscoveryCapabilityHttpsError(
  error: unknown,
): functions.https.HttpsError {
  if (!(error instanceof DiscoveryCapabilityError)) {
    return new functions.https.HttpsError("internal", "COMPLETION_INTERNAL_FAILURE");
  }
  const permissionDenied = new Set([
    "CAPABILITY_NOT_FOUND",
    "CAPABILITY_TYPE_MISMATCH",
    "CAPABILITY_BINDING_MISMATCH",
    "CAPABILITY_GENERATION_MISMATCH",
    "REPORT_CAPABILITY_REQUIRED",
  ]);
  const failedPrecondition = new Set([
    "CAPABILITY_EXPIRED",
    "CAPABILITY_REVOKED",
    "CAPABILITY_ALREADY_CONSUMED",
    "SESSION_ALREADY_COMPLETED",
  ]);
  const status = permissionDenied.has(error.code)
    ? "permission-denied"
    : failedPrecondition.has(error.code)
      ? "failed-precondition"
      : error.code === "COMPLETION_REQUEST_CONFLICT"
        ? "already-exists"
        : "internal";
  return new functions.https.HttpsError(status, error.code);
}

async function resolveNotificationRecipient(
  db: Firestore,
  completion: DiscoveryCompletionRecordV1,
): Promise<string | null> {
  if (completion.advisorUid && completion.advisorUid !== "UNKNOWN") {
    return completion.advisorUid;
  }
  if (completion.advisorId && completion.advisorId !== "UNKNOWN") {
    const advisor = await db.collection("platform_sales_advisors")
      .doc(completion.advisorId).get();
    const uid = advisor.data()?.uid;
    if (typeof uid === "string" && uid !== "UNKNOWN" && uid.trim() !== "") {
      return uid;
    }
  }
  if (!completion.prospectId) return null;
  const prospect = await db.collection("platform_leads").doc(completion.prospectId).get();
  const currentAdvisorId = prospect.data()?.currentAdvisorId;
  if (
    typeof currentAdvisorId !== "string" || currentAdvisorId === "UNKNOWN" ||
    currentAdvisorId === "UNASSIGNED" || currentAdvisorId.trim() === ""
  ) {
    return null;
  }
  const advisor = await db.collection("platform_sales_advisors")
    .doc(currentAdvisorId).get();
  const uid = advisor.data()?.uid;
  return typeof uid === "string" && uid !== "UNKNOWN" && uid.trim() !== ""
    ? uid
    : null;
}

export async function dispatchDiscoveryCompletionOutbox(
  db: Firestore,
  completion: DiscoveryCompletionRecordV1,
): Promise<void> {
  const outboxId = hashDiscoveryCapabilityToken(completion.notificationKey);
  const outboxRef = db.collection(DISCOVERY_COMPLETION_OUTBOX_COLLECTION).doc(outboxId);
  const outbox = await outboxRef.get();
  if (!outbox.exists || outbox.data()?.completionId !== completion.completionId) {
    throw new DiscoveryCapabilityError(
      "COMPLETION_INTERNAL_FAILURE", "Completion outbox is unavailable.",
    );
  }
  if (outbox.data()?.status === "ENQUEUED" || outbox.data()?.status === "SKIPPED") {
    return;
  }
  const recipientUid = await resolveNotificationRecipient(db, completion);
  if (!recipientUid) {
    await outboxRef.update({
      status: "SKIPPED", reason: "NO_RECIPIENT",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }
  const taskId = hashDiscoveryCapabilityToken(completion.notificationKey);
  try {
    await getFunctions().taskQueue("emitDiscoveryCompletedNotification").enqueue({
      discoverySessionId: completion.sessionId,
      dossierId: completion.dossierId,
      advisorUid: recipientUid,
      tenantId: "aura_root",
      companyName: completion.companyName,
      prospectName: completion.prospectName,
      correlationId: completion.completionId,
      idempotencyKey: completion.notificationKey,
    }, { id: taskId, dispatchDeadlineSeconds: 15 });
  } catch (error: unknown) {
    const code = (error as { code?: unknown })?.code;
    if (code !== "functions/task-already-exists") throw error;
  }
  await outboxRef.update({
    status: "ENQUEUED", taskId, recipientUid,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
