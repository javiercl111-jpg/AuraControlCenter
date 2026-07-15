"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.provisionCommercialAdvisor = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
/**
 * Creates or provisions a Sales Advisor user securely with compensation.
 */
exports.provisionCommercialAdvisor = (0, https_1.onCall)({
    enforceAppCheck: true, // App Check active in production
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Debes iniciar sesión para realizar esta acción.");
    }
    const { name, email, phone, assignedStates, assignedCities, specialties, commissionPlanId, } = request.data;
    if (!name || !email) {
        throw new https_1.HttpsError("invalid-argument", "Nombre y correo son obligatorios.");
    }
    const db = admin.firestore();
    const auth = admin.auth();
    const normalizedEmail = email.trim().toLowerCase();
    // 1. Validate Caller Role (Security revision: ADMIN removed, advisors.manage capability capability mapping)
    const callerDoc = await db.collection("platform_global_admins").doc(request.auth.uid).get();
    if (!callerDoc.exists) {
        throw new https_1.HttpsError("permission-denied", "No tienes permisos de administrador.");
    }
    const callerData = callerDoc.data();
    const allowedRoles = ["SUPER_ADMIN", "FOUNDER", "SALES_DIRECTOR", "PLATFORM_OWNER"];
    if (!allowedRoles.includes(callerData?.role)) {
        throw new https_1.HttpsError("permission-denied", "Rol insuficiente para crear asesores.");
    }
    const isOwner = callerData?.role === "SUPER_ADMIN" || callerData?.role === "FOUNDER" || callerData?.role === "PLATFORM_OWNER";
    // 2. Check if Email already exists in platform_sales_advisors (No silent reassignments)
    const emailQuery = await db.collection("platform_sales_advisors")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();
    if (!emailQuery.empty) {
        throw new https_1.HttpsError("already-exists", "El correo ya está registrado con otro asesor comercial en la base de datos.");
    }
    // 3. Check Auth User Existence and conflicts
    let uid = "";
    let authUserCreated = false;
    let authPreExisting = false;
    try {
        const existingUser = await auth.getUserByEmail(normalizedEmail);
        uid = existingUser.uid;
        authPreExisting = true;
        // Validate that pre-existing Auth User is not linked to another advisor
        const uidQuery = await db.collection("platform_sales_advisors")
            .where("uid", "==", uid)
            .limit(1)
            .get();
        if (!uidQuery.empty) {
            throw new https_1.HttpsError("already-exists", "El usuario de Auth ya está asociado a otro asesor comercial en la base de datos.");
        }
    }
    catch (e) {
        if (e.code === "auth/user-not-found") {
            try {
                const newUser = await auth.createUser({
                    email: normalizedEmail,
                    displayName: name,
                    emailVerified: false, // Must remain false per security rules
                });
                uid = newUser.uid;
                authUserCreated = true;
            }
            catch (createErr) {
                throw new https_1.HttpsError("internal", "Error al crear el usuario en Auth: " + createErr.message);
            }
        }
        else {
            throw new https_1.HttpsError("internal", "Error verificando usuario de Auth: " + e.message);
        }
    }
    // State trackers for compensation logic
    let firestoreDocCreated = false;
    let advisorId = "";
    let commercialCode = "";
    let codeReserved = false;
    try {
        // 4. Generate unique Commercial Code transationally
        let attempt = 0;
        // Base generation: First letters of name + random numbers
        const nameParts = name.split(" ");
        const baseChars = nameParts.length >= 2
            ? (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase()
            : nameParts[0].substring(0, 2).toUpperCase();
        while (!codeReserved && attempt < 5) {
            const randomNum = Math.floor(100 + Math.random() * 900); // 3 digits
            const testCode = `${baseChars}${randomNum}`.replace(/[^A-Z0-9]/g, "");
            const codeRef = db.collection("advisor_commercial_codes").doc(testCode);
            try {
                await db.runTransaction(async (t) => {
                    const doc = await t.get(codeRef);
                    if (!doc.exists) {
                        // Not used, reserve it
                        advisorId = db.collection("platform_sales_advisors").doc().id;
                        commercialCode = testCode;
                        t.set(codeRef, {
                            advisorId,
                            uid,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            status: "RESERVED"
                        });
                        codeReserved = true;
                    }
                });
            }
            catch (err) {
                // Transaction failed (collision), retry
            }
            attempt++;
        }
        if (!codeReserved) {
            // Fallback: fully random code if collisions persisted
            advisorId = db.collection("platform_sales_advisors").doc().id;
            commercialCode = `ADV${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            await db.collection("advisor_commercial_codes").doc(commercialCode).set({
                advisorId,
                uid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: "RESERVED_FALLBACK"
            });
            codeReserved = true;
        }
        // 5. Create Profile document in platform_sales_advisors
        await db.collection("platform_sales_advisors").doc(advisorId).set({
            advisorId,
            uid,
            name,
            email: normalizedEmail,
            phone: phone || "",
            commercialCode,
            discoveryLink: `https://controlcenter.auranexus.io/discover/advisor/${commercialCode}`,
            assignedStates: assignedStates || [],
            assignedCities: assignedCities || [],
            specialties: specialties || [],
            commissionPlanId: commissionPlanId || "STANDARD_TIER_1",
            authStatus: authPreExisting ? "NOT_CREATED" : "CREATED",
            invitationStatus: "PENDING",
            advisorStatus: "ACTIVE",
            provisioningStatus: "SUCCESS",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        firestoreDocCreated = true;
        // 6. Give minimal role in platform_global_admins just in case they log in to control center
        await db.collection("platform_global_admins").doc(uid).set({
            email: normalizedEmail,
            role: "SALES_ADVISOR",
            advisorId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        // 7. Update Custom Claims
        await auth.setCustomUserClaims(uid, {
            roleCode: "SALES_ADVISOR",
            advisorId: advisorId
        });
        // 8. Generate Activation Link
        const actionCodeSettings = {
            url: `https://controlcenter.auranexus.io/activate-advisor`,
            handleCodeInApp: true,
        };
        let activationLink = "";
        let invitationStatus = "LINK_GENERATED";
        try {
            activationLink = await auth.generatePasswordResetLink(normalizedEmail, actionCodeSettings);
            // SMTP not configured yet, mark as SEND_FAILED so it requires admin manual copy
            invitationStatus = "SEND_FAILED";
            await db.collection("platform_sales_advisors").doc(advisorId).update({
                invitationStatus,
                lastSafeErrorCode: "SMTP_NOT_CONFIGURED",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        catch (err) {
            throw new Error("Error generando el enlace de activación: " + err.message);
        }
        return {
            success: true,
            advisorId,
            uid,
            commercialCode,
            invitationStatus,
            activationLink: (isOwner && invitationStatus === "SEND_FAILED") ? activationLink : null,
            message: "Asesor creado con éxito."
        };
    }
    catch (dbErr) {
        // 9. Full compensation logic: Revert changes in reverse order of creation
        console.warn("[Compensación] Iniciando compensación segura de creación de asesor comercial...");
        if (firestoreDocCreated && advisorId) {
            try {
                await db.collection("platform_sales_advisors").doc(advisorId).delete();
                await db.collection("platform_global_admins").doc(uid).delete();
                console.log(`[Compensación] Perfil Firestore del asesor ${advisorId} eliminado.`);
            }
            catch (delFsErr) {
                console.error(`[Compensación] Error al eliminar perfil Firestore ${advisorId}:`, delFsErr);
            }
        }
        if (codeReserved && commercialCode) {
            try {
                await db.collection("advisor_commercial_codes").doc(commercialCode).delete();
                console.log(`[Compensación] Código comercial reservado ${commercialCode} eliminado.`);
            }
            catch (delCodeErr) {
                console.error(`[Compensación] Error al eliminar código reservado ${commercialCode}:`, delCodeErr);
            }
        }
        if (authUserCreated && uid) {
            try {
                await auth.deleteUser(uid);
                console.log(`[Compensación] Usuario recién creado de Auth ${uid} eliminado.`);
            }
            catch (delAuthErr) {
                console.error(`[Compensación] Error al eliminar usuario de Auth recién creado ${uid}:`, delAuthErr);
            }
        }
        throw new https_1.HttpsError("internal", dbErr.message || "Error al completar el aprovisionamiento del asesor.");
    }
});
//# sourceMappingURL=provisionCommercialAdvisor.js.map