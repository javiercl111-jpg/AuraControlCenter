"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replenishAdvisorPipeline = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
/**
 * Compare function for deterministically sorting pipeline priority in backend.
 */
function comparePipelinePriority(a, b) {
    const getPriorityWeight = (c) => {
        const p = c.priorityLevel || "LOW";
        if (p === "CRITICAL")
            return 3;
        if (p === "HIGH")
            return 2;
        if (p === "MEDIUM")
            return 1;
        return 0;
    };
    const weightA = getPriorityWeight(a);
    const weightB = getPriorityWeight(b);
    if (weightA !== weightB) {
        return weightB - weightA;
    }
    const scoreA = a.opportunityScore || 0;
    const scoreB = b.opportunityScore || 0;
    if (scoreA !== scoreB) {
        return scoreB - scoreA;
    }
    const getTimestamp = (c) => {
        if (c.updatedAt) {
            if (typeof c.updatedAt === "number")
                return c.updatedAt;
            if (typeof c.updatedAt === "string")
                return new Date(c.updatedAt).getTime();
            if (c.updatedAt && c.updatedAt.seconds)
                return c.updatedAt.seconds * 1000;
        }
        if (c.createdAt) {
            if (typeof c.createdAt === "number")
                return c.createdAt;
            if (typeof c.createdAt === "string")
                return new Date(c.createdAt).getTime();
            if (c.createdAt && c.createdAt.seconds)
                return c.createdAt.seconds * 1000;
        }
        return 0;
    };
    return getTimestamp(b) - getTimestamp(a);
}
/**
 * Transactionally replenishes the active pipeline of a sales advisor.
 */
exports.replenishAdvisorPipeline = (0, https_1.onCall)({
    enforceAppCheck: true, // App Check active in production
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Debes iniciar sesión para realizar esta acción.");
    }
    const { advisorId: inputAdvisorId, targetSize: inputTargetSize, idempotencyKey } = request.data;
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
        throw new https_1.HttpsError("invalid-argument", "El campo idempotencyKey es obligatorio.");
    }
    const db = admin.firestore();
    // 1. Resolve Advisor ID and Validate Permissions
    let advisorId = inputAdvisorId;
    const callerUid = request.auth.uid;
    const callerDoc = await db.collection("platform_global_admins").doc(callerUid).get();
    if (!callerDoc.exists) {
        throw new https_1.HttpsError("permission-denied", "No tienes permisos de administrador.");
    }
    const callerData = callerDoc.data();
    const allowedRoles = ["SUPER_ADMIN", "FOUNDER", "SALES_DIRECTOR", "PLATFORM_OWNER"];
    const isAdmin = allowedRoles.includes(callerData?.role);
    // If advisorId is not specified, resolve from caller's auth context
    if (!advisorId) {
        const advisorQuery = await db.collection("platform_sales_advisors")
            .where("uid", "==", callerUid)
            .limit(1)
            .get();
        if (advisorQuery.empty) {
            throw new https_1.HttpsError("permission-denied", "No se encontró un perfil de asesor comercial asociado.");
        }
        advisorId = advisorQuery.docs[0].id;
    }
    else {
        // If specifying another advisor, caller must be admin
        if (!isAdmin && advisorId !== callerData?.advisorId) {
            throw new https_1.HttpsError("permission-denied", "No tienes permisos para reponer el pipeline de otro asesor.");
        }
    }
    // Target size bounds validation (1 to 20, default 10)
    let targetSize = Number(inputTargetSize) || 10;
    if (targetSize < 1 || targetSize > 20) {
        targetSize = 10;
    }
    const idempotencyRef = db.collection("idempotency_keys").doc(idempotencyKey);
    const result = await db.runTransaction(async (transaction) => {
        // 2. Check Idempotency Key
        const idempDoc = await transaction.get(idempotencyRef);
        if (idempDoc.exists) {
            return idempDoc.data()?.response;
        }
        // 3. Count ACTIVE or CONTACTED assignments for this advisor
        const activeAssignmentsQuery = db.collection("commercial_pipeline_assignments")
            .where("advisorId", "==", advisorId)
            .where("status", "in", ["ACTIVE", "CONTACTED"]);
        const activeSnap = await transaction.get(activeAssignmentsQuery);
        const currentActiveCount = activeSnap.size;
        const spacesToFill = Math.max(0, targetSize - currentActiveCount);
        if (spacesToFill === 0) {
            const emptyResponse = {
                currentSize: currentActiveCount,
                assignedCount: 0,
                assignmentIds: [],
                marketCompanyIds: [],
                targetSize
            };
            transaction.set(idempotencyRef, {
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                response: emptyResponse
            });
            return emptyResponse;
        }
        // 4. Fetch potential candidates from Reservoir
        // Note: We fetch a batch of NEW status companies sorted by score
        const reservoirQuery = db.collection("market_companies")
            .where("status", "==", "NEW")
            .where("opportunityScore", ">=", 70)
            .orderBy("opportunityScore", "desc")
            .limit(100);
        const candidateSnap = await transaction.get(reservoirQuery);
        const eligible = candidateSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(c => !c.assignedAdvisorId && c.email && c.telefono && !c.convertedOrganizationId);
        // Deterministic sort
        eligible.sort(comparePipelinePriority);
        const toAssign = eligible.slice(0, spacesToFill);
        const assignmentIds = [];
        const marketCompanyIds = [];
        for (const company of toAssign) {
            const assignmentId = db.collection("commercial_pipeline_assignments").doc().id;
            const assignmentRef = db.collection("commercial_pipeline_assignments").doc(assignmentId);
            transaction.set(assignmentRef, {
                assignmentId,
                advisorId,
                marketCompanyId: company.id,
                status: "ACTIVE",
                assignedAt: admin.firestore.FieldValue.serverTimestamp(),
                assignedBy: callerUid,
                previousStatus: company.status || "NEW",
                source: "AUTO_REPLENISH",
                idempotencyKey,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            const companyRef = db.collection("market_companies").doc(company.id);
            transaction.update(companyRef, {
                assignedAdvisorId: advisorId,
                activeAssignmentId: assignmentId,
                assignedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            assignmentIds.push(assignmentId);
            marketCompanyIds.push(company.id);
        }
        const finalResponse = {
            currentSize: currentActiveCount + toAssign.length,
            assignedCount: toAssign.length,
            assignmentIds,
            marketCompanyIds,
            targetSize
        };
        transaction.set(idempotencyRef, {
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            response: finalResponse
        });
        return finalResponse;
    });
    // 5. Emit event for notifications (Fase F preparation)
    try {
        const eventId = db.collection("platform_events").doc().id;
        await db.collection("platform_events").doc(eventId).set({
            eventId,
            type: "PIPELINE_REPLENISHED",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            recipientAdvisorId: advisorId,
            actorId: callerUid,
            metadata: {
                advisorId,
                assignedCount: result.assignedCount,
                currentSize: result.currentSize,
                targetSize
            }
        });
    }
    catch (evtErr) {
        console.error("Fallo al registrar evento PIPELINE_REPLENISHED:", evtErr);
    }
    return result;
});
//# sourceMappingURL=replenishAdvisorPipeline.js.map