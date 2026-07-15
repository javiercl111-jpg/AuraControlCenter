import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

/**
 * Compare function for deterministically sorting pipeline priority in backend.
 */
function comparePipelinePriority(a: any, b: any): number {
  const getPriorityWeight = (c: any): number => {
    const p = c.priorityLevel || "LOW";
    if (p === "CRITICAL") return 3;
    if (p === "HIGH") return 2;
    if (p === "MEDIUM") return 1;
    return 0;
  };

  const weightA = getPriorityWeight(a);
  const weightB = getPriorityWeight(b);

  if (weightA !== weightB) return weightB - weightA;

  const scoreA = a.opportunityScore || 0;
  const scoreB = b.opportunityScore || 0;
  if (scoreA !== scoreB) return scoreB - scoreA;

  const getTimestamp = (c: any): number => {
    if (c.updatedAt) {
      if (typeof c.updatedAt === "number") return c.updatedAt;
      if (typeof c.updatedAt === "string") return new Date(c.updatedAt).getTime();
      if (c.updatedAt && c.updatedAt.seconds) return c.updatedAt.seconds * 1000;
    }
    if (c.createdAt) {
      if (typeof c.createdAt === "number") return c.createdAt;
      if (typeof c.createdAt === "string") return new Date(c.createdAt).getTime();
      if (c.createdAt && c.createdAt.seconds) return c.createdAt.seconds * 1000;
    }
    return 0;
  };

  return getTimestamp(b) - getTimestamp(a);
}

/**
 * Transactionally discards a pipeline prospect and replenishes one position.
 */
export const discardPipelineProspect = onCall(
  {
    enforceAppCheck: true, // App Check active in production
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para realizar esta acción.");
    }

    const { assignmentId, reasonCode, reasonText, idempotencyKey } = request.data;

    if (!assignmentId || !reasonCode || !idempotencyKey) {
      throw new HttpsError("invalid-argument", "Los campos assignmentId, reasonCode e idempotencyKey son obligatorios.");
    }

    const validReasonCodes = ["NO_INTEREST", "BAD_CONTACT_DATA", "UNREACHABLE", "DUPLICATE", "OUT_OF_TARGET", "OTHER"];
    if (!validReasonCodes.includes(reasonCode)) {
      throw new HttpsError("invalid-argument", "Código de descarte inválido.");
    }

    const db = admin.firestore();
    const callerUid = request.auth.uid;

    const callerDoc = await db.collection("platform_global_admins").doc(callerUid).get();
    if (!callerDoc.exists) {
      throw new HttpsError("permission-denied", "No tienes permisos de administrador.");
    }
    const callerData = callerDoc.data();
    const allowedRoles = ["SUPER_ADMIN", "FOUNDER", "SALES_DIRECTOR", "PLATFORM_OWNER"];
    const isAdmin = allowedRoles.includes(callerData?.role);

    const assignmentRef = db.collection("commercial_pipeline_assignments").doc(assignmentId);
    const idempotencyRef = db.collection("idempotency_keys").doc(idempotencyKey);

    let advisorId = "";
    let companyId = "";

    const result = await db.runTransaction(async (transaction) => {
      // 1. Check Idempotency Key
      const idempDoc = await transaction.get(idempotencyRef);
      if (idempDoc.exists) {
        return idempDoc.data()?.response;
      }

      // 2. Fetch active assignment
      const assignmentSnap = await transaction.get(assignmentRef);
      if (!assignmentSnap.exists) {
        throw new HttpsError("not-found", "Asignación de pipeline comercial no encontrada.");
      }

      const assignment = assignmentSnap.data()!;
      if (assignment.status !== "ACTIVE" && assignment.status !== "CONTACTED") {
        throw new HttpsError("failed-precondition", "La asignación debe estar activa para poder descartarse.");
      }

      advisorId = assignment.advisorId;
      companyId = assignment.marketCompanyId;

      // Validate permission: caller must be admin or the assigned advisor
      if (!isAdmin) {
        const advisorDoc = await db.collection("platform_sales_advisors").doc(advisorId).get();
        if (advisorDoc.data()?.uid !== callerUid) {
          throw new HttpsError("permission-denied", "No tienes permisos para descartar este prospecto asignado.");
        }
        if (advisorDoc.data()?.advisorStatus === "INACTIVE" || advisorDoc.data()?.advisorStatus === "SUSPENDED") {
          throw new HttpsError("permission-denied", "Tu cuenta de asesor está inactiva o suspendida.");
        }
      }

      const companyRef = db.collection("market_companies").doc(companyId);
      const companySnap = await transaction.get(companyRef);

      if (!companySnap.exists) {
        throw new HttpsError("not-found", "El prospecto comercial no existe.");
      }

      // 3. Mark Assignment as DISCARDED
      transaction.update(assignmentRef, {
        status: "DISCARDED",
        releasedAt: admin.firestore.FieldValue.serverTimestamp(),
        releaseReason: reasonCode,
        reasonText: reasonText || "",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        discardedBy: callerUid
      });

      // 4. Update Market Company
      transaction.update(companyRef, {
        status: "DISCARDED",
        assignedAdvisorId: null,
        activeAssignmentId: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 5. Automatic replenishment of 1 slot
      const activeAssignmentsQuery = db.collection("commercial_pipeline_assignments")
        .where("advisorId", "==", advisorId)
        .where("status", "in", ["ACTIVE", "CONTACTED"]);

      const activeSnap = await transaction.get(activeAssignmentsQuery);
      // Wait: Since we updated `assignmentRef` to "DISCARDED" just above, we must exclude it if activeAssignmentsQuery includes it.
      // Firestore transaction reads do not see transaction writes dynamically!
      // So activeSnap size will still contain this assignment! We must subtract 1!
      let currentActiveCount = activeSnap.size;
      if (activeSnap.docs.some(d => d.id === assignmentId)) {
        currentActiveCount = Math.max(0, currentActiveCount - 1);
      }

      const targetSize = 10;
      const spacesToFill = Math.max(0, targetSize - currentActiveCount);

      const assignedCompanyIds: string[] = [];
      const assignedAssignmentIds: string[] = [];

      if (spacesToFill > 0) {
        const reservoirQuery = db.collection("market_companies")
          .where("status", "==", "NEW")
          .where("opportunityScore", ">=", 70)
          .orderBy("opportunityScore", "desc")
          .limit(100);

        const candidateSnap = await transaction.get(reservoirQuery);
        const eligible = candidateSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(c => !c.assignedAdvisorId && c.id !== companyId && c.email && c.telefono && !c.convertedOrganizationId);

        eligible.sort(comparePipelinePriority);

        const toAssign = eligible.slice(0, spacesToFill);

        for (const comp of toAssign) {
          const newAssignmentId = db.collection("commercial_pipeline_assignments").doc().id;
          const newAssignmentRef = db.collection("commercial_pipeline_assignments").doc(newAssignmentId);
          
          transaction.set(newAssignmentRef, {
            assignmentId: newAssignmentId,
            advisorId,
            marketCompanyId: comp.id,
            status: "ACTIVE",
            assignedAt: admin.firestore.FieldValue.serverTimestamp(),
            assignedBy: callerUid,
            previousStatus: comp.status || "NEW",
            source: "AUTO_REPLENISH_DISCARD",
            idempotencyKey,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          const newCompanyRef = db.collection("market_companies").doc(comp.id);
          transaction.update(newCompanyRef, {
            assignedAdvisorId: advisorId,
            activeAssignmentId: newAssignmentId,
            assignedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          assignedCompanyIds.push(comp.id);
          assignedAssignmentIds.push(newAssignmentId);
        }
      }

      const finalResponse = {
        success: true,
        discardedCompanyId: companyId,
        replenishedCount: assignedCompanyIds.length,
        replenishedCompanyIds: assignedCompanyIds,
        replenishedAssignmentIds: assignedAssignmentIds
      };

      transaction.set(idempotencyRef, {
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        response: finalResponse
      });

      return finalResponse;
    });

    // 6. Emit events for notifications
    try {
      const eventId1 = db.collection("platform_events").doc().id;
      await db.collection("platform_events").doc(eventId1).set({
        eventId: eventId1,
        type: "PROSPECT_DISCARDED",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        recipientAdvisorId: advisorId,
        actorId: callerUid,
        metadata: {
          assignmentId,
          marketCompanyId: companyId,
          reasonCode,
          reasonText: reasonText || ""
        } as Record<string, unknown>
      });

      if (result.replenishedCount > 0) {
        const eventId2 = db.collection("platform_events").doc().id;
        await db.collection("platform_events").doc(eventId2).set({
          eventId: eventId2,
          type: "PIPELINE_REPLENISHED",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          recipientAdvisorId: advisorId,
          actorId: callerUid,
          metadata: {
            advisorId: advisorId,
            assignedCount: result.replenishedCount,
            reason: "AUTO_REPLENISH_DISCARD"
          } as Record<string, unknown>
        });
      }
    } catch (evtErr) {
      console.error("Fallo al registrar eventos de descarte:", evtErr);
    }

    return result;
  }
);
