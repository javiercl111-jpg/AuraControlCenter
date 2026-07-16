"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePlatformPrincipal = resolvePlatformPrincipal;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
/**
 * Resolves the calling user's admin principal securely.
 * Checks by UID first, and uses email fallback only for legacy accounts.
 * Performs dynamic reconciliation upon resolving via email fallback.
 */
async function resolvePlatformPrincipal(db, authContext) {
    if (!authContext || !authContext.uid) {
        throw new https_1.HttpsError("unauthenticated", "Debes iniciar sesión para realizar esta acción.");
    }
    const callerUid = authContext.uid;
    // 1. Resolve by UID first
    const uidRef = db.collection("platform_global_admins").doc(callerUid);
    const uidDoc = await uidRef.get();
    if (uidDoc.exists) {
        const data = uidDoc.data();
        const isActive = data.isActive !== false && data.status !== "INACTIVE";
        if (!isActive) {
            throw new https_1.HttpsError("permission-denied", "Acceso deshabilitado para esta cuenta.");
        }
        // Normalization of legacy roles like PARTNER to PLATFORM_PARTNER
        let role = (data.role || data.roleCode || data.type || "VIEWER").toUpperCase();
        if (role === "PARTNER") {
            role = "PLATFORM_PARTNER";
        }
        return {
            id: uidDoc.id,
            email: data.email || "",
            displayName: data.displayName,
            role,
            isActive,
            advisorId: data.advisorId,
            uid: data.uid || callerUid,
        };
    }
    // 2. Email fallback for legacy accounts
    if (!authContext.token?.email) {
        throw new https_1.HttpsError("permission-denied", "No se encontró registro de administrador para este usuario.");
    }
    const normalizedEmail = authContext.token.email.trim().toLowerCase();
    // Try to get document by email ID directly
    const emailRef = db.collection("platform_global_admins").doc(normalizedEmail);
    const emailDoc = await emailRef.get();
    let targetDoc = null;
    if (emailDoc.exists) {
        targetDoc = emailDoc;
    }
    else {
        // If not found by document ID, query by email field
        const emailQuery = await db.collection("platform_global_admins")
            .where("email", "==", normalizedEmail)
            .limit(2)
            .get();
        if (emailQuery.size > 1) {
            throw new https_1.HttpsError("failed-precondition", "Conflicto de correo electrónico: múltiples cuentas coinciden.");
        }
        if (!emailQuery.empty) {
            targetDoc = emailQuery.docs[0];
        }
    }
    if (!targetDoc) {
        throw new https_1.HttpsError("permission-denied", "No tienes permisos de administrador.");
    }
    const data = targetDoc.data();
    // Exclude inactive aliases from automatic reconciliation
    if (data.identityStatus === "INACTIVE_ALIAS") {
        throw new https_1.HttpsError("permission-denied", "Esta cuenta ha sido consolidada y no está activa como identidad administrativa.");
    }
    const isActive = data.isActive !== false && data.status !== "INACTIVE";
    if (!isActive) {
        throw new https_1.HttpsError("permission-denied", "Acceso deshabilitado para esta cuenta.");
    }
    // Verify pre-existing authUid does not conflict
    if (data.uid && data.uid !== callerUid) {
        throw new https_1.HttpsError("failed-precondition", "El correo ya está vinculado a otro identificador único.");
    }
    let role = (data.role || data.roleCode || data.type || "VIEWER").toUpperCase();
    if (role === "PARTNER") {
        role = "PLATFORM_PARTNER";
    }
    try {
        await db.runTransaction(async (transaction) => {
            const newRef = db.collection("platform_global_admins").doc(callerUid);
            const newDoc = await transaction.get(newRef);
            // Rule 2: Comprobar que no exista ya otro documento con ID = UID
            if (newDoc.exists) {
                throw new https_1.HttpsError("failed-precondition", "Conflicto: ya existe un administrador registrado con este identificador único (UID).");
            }
            // Re-fetch the targetDoc inside transaction to ensure atomic execution
            const legacyDoc = await transaction.get(targetDoc.ref);
            if (!legacyDoc.exists) {
                throw new https_1.HttpsError("not-found", "El registro heredado no existe al momento de la transacción.");
            }
            const legacyData = legacyDoc.data();
            // Rule 8: No eliminar nada si existe conflicto (e.g., ya tiene otro UID/authUid asociado)
            if ((legacyData.uid && legacyData.uid !== callerUid) ||
                (legacyData.authUid && legacyData.authUid !== callerUid)) {
                throw new https_1.HttpsError("failed-precondition", "Conflicto: El registro heredado está vinculado a otro identificador único.");
            }
            // Rule 10: Mantener referencias y advisorId existentes.
            // Rule 9: No crear dos platform_sales_advisors para la misma cuenta.
            if (legacyData.advisorId) {
                const advisorRef = db.collection("platform_sales_advisors").doc(legacyData.advisorId);
                const advisorDoc = await transaction.get(advisorRef);
                if (advisorDoc.exists) {
                    const advData = advisorDoc.data();
                    if (!advData.uid || advData.uid !== callerUid) {
                        transaction.update(advisorRef, {
                            uid: callerUid,
                            authUid: callerUid,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }
                }
            }
            // Rule 4: Preservar todos los campos y timestamps relevantes.
            // Rule 5: Actualizar authUid.
            const newDocData = {
                ...legacyData,
                uid: callerUid,
                authUid: callerUid,
                role, // Normalized role
                resolvedBy: "resolvePlatformPrincipal",
                reconciledAt: new Date().toISOString(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            // Rule 3: Crear o fusionar el documento UID dentro de una transacción.
            transaction.set(newRef, newDocData);
            // Rule 7: Eliminar el documento heredado únicamente cuando la nueva copia quede confirmada.
            if (legacyDoc.id !== callerUid) {
                transaction.delete(legacyDoc.ref);
            }
            // Rule 6: Registrar previousDocumentId y newDocumentId en platform_audit_logs.
            const auditRef = db.collection("platform_audit_logs").doc();
            transaction.set(auditRef, {
                auditId: auditRef.id,
                action: "ACCOUNT_RECONCILIATION",
                email: normalizedEmail,
                uid: callerUid,
                previousDocumentId: legacyDoc.id,
                newDocumentId: callerUid,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                metadata: {
                    role,
                    advisorId: legacyData.advisorId || null,
                }
            });
        });
        console.log(`[Reconciliación] Cuenta heredada ${normalizedEmail} migrada exitosamente a UID ${callerUid}`);
    }
    catch (err) {
        console.error(`[Reconciliación] Error al conciliar UID/email para ${normalizedEmail}:`, err);
        throw new https_1.HttpsError("failed-precondition", `Error en la reconciliación de identidad: ${err.message}`);
    }
    return {
        id: callerUid,
        email: normalizedEmail,
        displayName: data.displayName,
        role,
        isActive,
        advisorId: data.advisorId,
        uid: callerUid,
    };
}
//# sourceMappingURL=resolvePlatformPrincipal.js.map