"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeDiscoverySession = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const discoverySecurityService_1 = require("./discoverySecurityService");
exports.completeDiscoverySession = functions.https.onCall(async (request) => {
    if (request.app == undefined) {
        throw new functions.https.HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
    }
    const { linkId, sessionToken, dossierPayload } = request.data;
    if (!linkId || !sessionToken || !dossierPayload) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required parameters.");
    }
    const db = admin.firestore();
    const linkRef = db.collection("market_discovery_links").doc(linkId);
    const linkSnap = await linkRef.get();
    if (!linkSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Session not found.");
    }
    const linkData = linkSnap.data();
    const sessionTokenHash = (0, discoverySecurityService_1.generateTokenHash)(sessionToken);
    if (linkData.sessionTokenHash !== sessionTokenHash) {
        throw new functions.https.HttpsError("permission-denied", "Invalid session token.");
    }
    const dossierId = `dossier_${linkId}_${Date.now()}`;
    // Trust score and delivery rules logic check to modify payload if needed
    let finalExecutiveBriefing = dossierPayload.executiveBriefingDraft;
    let finalRadiografia = dossierPayload.radiografiaEmpresarialDraft;
    const trustDecision = linkData.trustScore?.decision || "ALLOW_FULL";
    if (trustDecision === "ALLOW_BASIC" || trustDecision === "REQUIRE_MANUAL_REVIEW" || trustDecision === "BLOCK_ABUSE") {
        // Basic delivery, strip out sensitive observations
        if (finalExecutiveBriefing) {
            finalExecutiveBriefing.keyObservations = ["Reporte en validación."];
            finalExecutiveBriefing.suggestedNextSteps = ["Un especialista de Aura evaluará tus respuestas."];
        }
        if (finalRadiografia) {
            finalRadiografia.overallStatus = "En evaluación...";
            finalRadiografia.recommendedModules = [];
            finalRadiografia.potentialSavings = "Pendiente de validación comercial.";
        }
    }
    if (trustDecision === "BLOCK_ABUSE") {
        finalExecutiveBriefing = null;
        finalRadiografia = null;
    }
    const finalPayload = {
        id: dossierId,
        linkId,
        ...dossierPayload,
        executiveBriefingDraft: finalExecutiveBriefing,
        radiografiaEmpresarialDraft: finalRadiografia,
        completedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const batch = db.batch();
    const sessionRef = db.collection("discovery_sessions").doc(dossierId);
    batch.set(sessionRef, finalPayload);
    if (linkId !== "demo") {
        batch.update(linkRef, {
            status: "completed",
            dossierId: dossierId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    await batch.commit();
    return { dossierId, trustDecision };
});
//# sourceMappingURL=completeDiscoverySession.js.map