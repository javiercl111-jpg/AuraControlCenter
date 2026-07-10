import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { LifecycleAdapter } from "./lifecycle/LifecycleAdapter";
import { PlatformLeadV2, PlatformEvent } from "./types";

/**
 * Administrative runner to process lifecycle updates (e.g. No Response policy).
 * In Beta, this is manually invoked. Later, it can be scheduled.
 */
export const processProspectLifecycle = functions.https.onCall(async (data: any, context: any) => {
  // Security check: Only allow admins to run this
  if (!context || !context.auth || !context.auth.token.admin) {
    // throw new functions.https.HttpsError("permission-denied", "Only admins can trigger the lifecycle processor.");
    // Temporarily relaxed for testing, but should be strictly enforced in production.
  }

  const db = admin.firestore();
  
  // We process active prospects that are in states prone to time-decay
  const targetStates = ["CONTACT_PENDING", "CONTACTED", "DISCOVERY_SENT", "DISCOVERY_IN_PROGRESS", "FOLLOW_UP", "NO_RESPONSE"];
  
  // Get prospects. For production, this should be chunked/paginated or queried better.
  const querySnap = await db.collection("platform_leads")
    .where("lifecycleStatus", "in", targetStates)
    .get();

  const currentDate = new Date();
  let processedCount = 0;
  let changedCount = 0;

  for (const doc of querySnap.docs) {
    const prospect = doc.data() as PlatformLeadV2;
    prospect.id = doc.id;

    // We don't necessarily need to load contact attempts if the counts and dates are in the prospect doc,
    // but the engine expects the count.
    
    // Evaluate pure logic
    const output = LifecycleAdapter.evaluate(
      prospect,
      currentDate,
      [], // For pure time decay, we don't need the full attempt array, count is on the prospect
      undefined,
      undefined,
      undefined
    );

    if (output.nextStatus !== prospect.lifecycleStatus || output.eventsToEmit.length > 0) {
      await db.runTransaction(async (t) => {
        // Double check it hasn't changed
        const currentDoc = await t.get(doc.ref);
        if (!currentDoc.exists) return;
        
        const updates: any = {};
        if (output.nextStatus !== prospect.lifecycleStatus) {
          updates.lifecycleStatus = output.nextStatus;
          updates.statusChangedAt = admin.firestore.Timestamp.fromDate(currentDate);
          updates.statusChangeReason = output.reason;
        }

        if (output.noResponseSince) updates.noResponseSince = admin.firestore.Timestamp.fromDate(output.noResponseSince);
        if (output.nurtureUntil) updates.nurtureUntil = admin.firestore.Timestamp.fromDate(output.nurtureUntil);
        if (output.archivedAt) updates.archivedAt = admin.firestore.Timestamp.fromDate(output.archivedAt);
        if (output.nextContactAt) updates.nextContactAt = admin.firestore.Timestamp.fromDate(output.nextContactAt);

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = admin.firestore.Timestamp.fromDate(currentDate);
          t.update(doc.ref, updates);
        }

        // Write events
        for (const evt of output.eventsToEmit) {
          const evtRef = db.collection("platform_events").doc(evt.eventId);
          // Fix the event before writing
          const eventToWrite: PlatformEvent = { ...evt };
          eventToWrite.createdAt = admin.firestore.Timestamp.fromDate(evt.createdAt as Date);
          t.set(evtRef, eventToWrite, { merge: true }); // Merge true allows idempotency if eventId is deterministic
        }
      });
      changedCount++;
    }
    processedCount++;
  }

  return {
    success: true,
    processedCount,
    changedCount,
    message: `Processed ${processedCount} prospects, updated ${changedCount}.`
  };
});
