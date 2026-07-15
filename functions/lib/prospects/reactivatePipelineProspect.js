"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reactivatePipelineProspect = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
/**
 * Transactionally reactivates a discarded market prospect, making it eligible for NEW assignments.
 */
exports.reactivatePipelineProspect = (0, https_1.onCall)({
    enforceAppCheck: true, // App Check active in production
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Debes iniciar sesión para realizar esta acción.");
    }
    const { companyId, reactivationReason, idempotencyKey } = request.data;
    if (!companyId || !idempotencyKey) {
        throw new https_1.HttpsError("invalid-argument", "Los campos companyId e idempotencyKey son obligatorios.");
    }
    const db = admin.firestore();
    const callerUid = request.auth.uid;
    // Validate admin permissions
    const callerDoc = await db.collection("platform_global_admins").doc(callerUid).get();
    if (!callerDoc.exists) {
        throw new https_1.HttpsError("permission-denied", "No tienes permisos de administrador.");
    }
    const callerData = callerDoc.data();
    const allowedRoles = ["SUPER_ADMIN", "FOUNDER", "SALES_DIRECTOR", "PLATFORM_OWNER"];
    const isAdmin = allowedRoles.includes(callerData?.role);
    if (!isAdmin) {
        throw new https_1.HttpsError("permission-denied", "Solo los administradores autorizados pueden reactivar prospectos.");
    }
    const companyRef = db.collection("market_companies").doc(companyId);
    const idempotencyRef = db.collection("idempotency_keys").doc(idempotencyKey);
    const result = await db.runTransaction(async (transaction) => {
        // 1. Check Idempotency Key
        const idempDoc = await transaction.get(idempotencyRef);
        if (idempDoc.exists) {
            return idempDoc.data()?.response;
        }
        // 2. Fetch company document
        const companySnap = await transaction.get(companyRef);
        if (!companySnap.exists) {
            throw new https_1.HttpsError("not-found", "El prospecto no existe.");
        }
        const company = companySnap.data();
        if (company.status !== "DISCARDED") {
            throw new https_1.HttpsError("failed-precondition", "El prospecto no está en estado descartado.");
        }
        // 3. Update company back to NEW
        transaction.update(companyRef, {
            status: "NEW",
            assignedAdvisorId: null,
            activeAssignmentId: null,
            lastReactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastReactivatedBy: callerUid,
            lastReactivationReason: reactivationReason || "",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const finalResponse = {
            success: true,
            companyId,
            reactivatedAt: new Date().toISOString()
        };
        transaction.set(idempotencyRef, {
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            response: finalResponse
        });
        return finalResponse;
    });
    // 4. Emit event for notifications
    try {
        const eventId = db.collection("platform_events").doc().id;
        await db.collection("platform_events").doc(eventId).set({
            eventId,
            type: "PROSPECT_REACTIVATED",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            actorId: callerUid,
            metadata: {
                companyId,
                reactivatedBy: callerUid,
                reactivationReason: reactivationReason || ""
            }
        });
    }
    catch (evtErr) {
        console.error("Fallo al registrar evento PROSPECT_REACTIVATED:", evtErr);
    }
    return result;
});
//# sourceMappingURL=reactivatePipelineProspect.js.map