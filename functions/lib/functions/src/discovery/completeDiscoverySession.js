"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeDiscoverySession = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const discoverySecurityService_1 = require("./discoverySecurityService");
const ProspectResolutionEngine_1 = require("../prospects/ProspectResolutionEngine");
const types_1 = require("../prospects/types");
exports.completeDiscoverySession = functions.https.onCall(async (request) => {
    if (request.app == undefined) {
        throw new functions.https.HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
    }
    const { linkId, sessionToken, dossierPayload } = request.data;
    if (!linkId || !sessionToken || !dossierPayload) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required parameters.");
    }
    // Validate the minimal dossier structure
    const requiredFields = ["companyName", "contactName", "dossier", "conversationHistory", "conversationStateSnapshot"];
    for (const field of requiredFields) {
        if (dossierPayload[field] === undefined) {
            throw new functions.https.HttpsError("invalid-argument", `Payload validation failed: missing ${field}`);
        }
    }
    if (typeof dossierPayload.companyName !== "string" || !dossierPayload.companyName.trim()) {
        throw new functions.https.HttpsError("invalid-argument", "companyName must be a valid string.");
    }
    if (!Array.isArray(dossierPayload.conversationHistory)) {
        throw new functions.https.HttpsError("invalid-argument", "conversationHistory must be an array.");
    }
    const db = admin.firestore();
    return await db.runTransaction(async (t) => {
        const linkRef = db.collection("market_discovery_links").doc(linkId);
        const linkSnap = await t.get(linkRef);
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
            createdAt: dossierPayload.createdAt ? dossierPayload.createdAt : admin.firestore.FieldValue.serverTimestamp(),
            executiveBriefingDraft: finalExecutiveBriefing,
            radiografiaEmpresarialDraft: finalRadiografia,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        // Call Prospect Resolution Engine BEFORE any writes
        const engine = new ProspectResolutionEngine_1.ProspectResolutionEngine();
        // Build payload for resolution
        // Build payload for resolution
        const mergePayload = {
            companyName: dossierPayload.companyName || linkData.companyName || "Unknown",
            contactName: dossierPayload.contactName || linkData.contactName || "Unknown",
            email: linkData.email || "", // we might want to get email from dossierPayload if it asks
            phone: linkData.phone || "",
            advisorId: linkData.advisorId,
            advisorUid: linkData.advisorUid,
            linkId: linkId,
            sourceLeadId: linkData.prospectId,
            origin: types_1.ProspectOrigin.WEBSITE, // or ADVISOR_SHARE if there's an advisor
            acquisitionSource: linkData.acquisitionSource || types_1.AcquisitionSource.DIRECT
        };
        if (linkData.advisorId && linkData.advisorId !== "UNKNOWN") {
            mergePayload.origin = types_1.ProspectOrigin.ADVISOR_SHARE;
        }
        const resolutionResult = await engine.resolveProspect(mergePayload, t);
        // Perform WRITES after ALL reads
        finalPayload.prospectId = resolutionResult.matchedProspectId || null;
        const sessionRef = db.collection("discovery_sessions").doc(dossierId);
        t.set(sessionRef, finalPayload);
        if (linkId !== "demo") {
            t.update(linkRef, {
                status: "completed",
                dossierId: dossierId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        // Emit DOSSIER_ATTACHED event
        if (resolutionResult.matchedProspectId) {
            const eventRef = db.collection("platform_events").doc();
            t.set(eventRef, {
                eventId: eventRef.id,
                type: "DOSSIER_ATTACHED",
                prospectId: resolutionResult.matchedProspectId,
                linkId,
                sessionId: dossierId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                actorType: "SYSTEM",
                source: "completeDiscoverySession",
                metadata: { dossierId }
            });
        }
        return {
            dossierId,
            trustDecision,
            prospectId: resolutionResult.matchedProspectId,
            resolutionStatus: resolutionResult.resolutionReason
        };
    });
});
//# sourceMappingURL=completeDiscoverySession.js.map