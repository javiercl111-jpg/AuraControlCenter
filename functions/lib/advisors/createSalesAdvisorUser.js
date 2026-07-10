"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSalesAdvisorUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
/**
 * Creates or provisions a Sales Advisor user.
 */
exports.createSalesAdvisorUser = (0, https_1.onCall)({
    enforceAppCheck: false, // For local dev/admin panel we might disable it, or configure properly
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
    // 1. Validate Caller Role
    const callerDoc = await db.collection("platform_global_admins").doc(request.auth.uid).get();
    if (!callerDoc.exists) {
        throw new https_1.HttpsError("permission-denied", "No tienes permisos de administrador.");
    }
    const callerData = callerDoc.data();
    const allowedRoles = ["SUPER_ADMIN", "FOUNDER", "SALES_DIRECTOR"];
    if (!allowedRoles.includes(callerData?.role)) {
        throw new https_1.HttpsError("permission-denied", "Rol insuficiente para crear asesores.");
    }
    // 2. Check Auth User Existence
    let uid;
    let authStatus = "NOT_CREATED";
    try {
        const existingUser = await auth.getUserByEmail(normalizedEmail);
        uid = existingUser.uid;
        authStatus = "CREATED";
    }
    catch (e) {
        if (e.code === "auth/user-not-found") {
            const newUser = await auth.createUser({
                email: normalizedEmail,
                displayName: name,
                emailVerified: true,
            });
            uid = newUser.uid;
            authStatus = "CREATED";
        }
        else {
            throw new https_1.HttpsError("internal", "Error verificando usuario de Auth: " + e.message);
        }
    }
    // 3. Search for existing Advisor Profile to avoid duplicates
    const advisorQuery = await db.collection("platform_sales_advisors")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();
    let advisorId = "";
    let commercialCode = "";
    let profileExists = !advisorQuery.empty;
    if (profileExists) {
        const existingProfile = advisorQuery.docs[0];
        advisorId = existingProfile.id;
        commercialCode = existingProfile.data().commercialCode;
        // Repair UID if missing
        if (!existingProfile.data().uid) {
            await existingProfile.ref.update({ uid });
        }
    }
    else {
        // 4. Generate unique Commercial Code transationally
        let codeReserved = false;
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
        }
        // Create profile
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
            authStatus,
            invitationStatus: "PENDING",
            advisorStatus: "ACTIVE",
            provisioningStatus: "SUCCESS",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Give minimal role in platform_global_admins just in case they log in to control center
        await db.collection("platform_global_admins").doc(uid).set({
            email: normalizedEmail,
            role: "SALES_ADVISOR",
            advisorId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    // 5. Update Custom Claims
    await auth.setCustomUserClaims(uid, {
        roleCode: "SALES_ADVISOR",
        advisorId: advisorId
    });
    // 6. Generate Activation Link
    const actionCodeSettings = {
        url: `https://controlcenter.auranexus.io/activate-advisor`,
        handleCodeInApp: true,
    };
    let activationLink = "";
    let invitationStatus = "LINK_GENERATED";
    try {
        activationLink = await auth.generatePasswordResetLink(normalizedEmail, actionCodeSettings);
        // TODO: Here we would send the email via SMTP. 
        // As it's not configured right now, we mark it as SEND_FAILED so the UI returns the link.
        invitationStatus = "SEND_FAILED";
        await db.collection("platform_sales_advisors").doc(advisorId).update({
            invitationStatus,
            lastSafeErrorCode: "SMTP_NOT_CONFIGURED",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        await db.collection("platform_sales_advisors").doc(advisorId).update({
            provisioningStatus: "ERROR",
            lastSafeErrorCode: err.code || "LINK_GENERATION_FAILED",
        });
        throw new https_1.HttpsError("internal", "Error generando el enlace de activación.");
    }
    return {
        success: true,
        advisorId,
        uid,
        commercialCode,
        invitationStatus,
        activationLink: invitationStatus === "SEND_FAILED" ? activationLink : null,
        message: "Asesor creado con éxito."
    };
});
//# sourceMappingURL=createSalesAdvisorUser.js.map