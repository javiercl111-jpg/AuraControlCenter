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
    const executionId = `exec_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log({
        executionId,
        stage: "VALIDATE_INPUT",
        requestDataKeys: Object.keys(request.data),
        hasDossierPayload: !!request.data.dossierPayload,
    });
    let linkId, sessionToken, dossierPayload;
    try {
        ({ linkId, sessionToken, dossierPayload } = request.data);
    }
    catch (error) {
        console.error({ executionId, stage: "VALIDATE_INPUT", name: error.name, message: error.message, stack: error.stack });
        throw new functions.https.HttpsError("internal", "VALIDATE_INPUT_FAILED");
    }
    if (!linkId || !sessionToken || !dossierPayload) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required parameters.");
    }
    try {
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
    }
    catch (error) {
        console.error({ executionId, stage: "VALIDATE_INPUT", name: error.name, message: error.message, stack: error.stack });
        throw error;
    }
    const db = admin.firestore();
    try {
        return await db.runTransaction(async (t) => {
            console.log({ executionId, stage: "LOAD_SESSION", linkId });
            let linkSnap, linkData;
            try {
                const linkRef = db.collection("market_discovery_links").doc(linkId);
                linkSnap = await t.get(linkRef);
                if (!linkSnap.exists) {
                    throw new functions.https.HttpsError("not-found", "Session not found.");
                }
                linkData = linkSnap.data();
                const sessionTokenHash = (0, discoverySecurityService_1.generateTokenHash)(sessionToken);
                if (linkData.sessionTokenHash !== sessionTokenHash) {
                    throw new functions.https.HttpsError("permission-denied", "Invalid session token.");
                }
            }
            catch (error) {
                console.error({ executionId, stage: "LOAD_SESSION", name: error.name, message: error.message, stack: error.stack });
                throw error;
            }
            const dossierId = `dossier_${linkId}_${Date.now()}`;
            console.log({ executionId, stage: "PREPARE_PAYLOAD", dossierId });
            let finalPayload;
            let trustDecision;
            try {
                trustDecision = linkData.trustScore?.decision || "ALLOW_FULL";
                let finalExecutiveBriefing = dossierPayload.executiveBriefingDraft;
                let finalRadiografia = dossierPayload.radiografiaEmpresarialDraft;
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
                finalPayload = {
                    id: dossierId,
                    linkId,
                    ...dossierPayload,
                    createdAt: dossierPayload.createdAt ? dossierPayload.createdAt : admin.firestore.FieldValue.serverTimestamp(),
                    executiveBriefingDraft: finalExecutiveBriefing,
                    radiografiaEmpresarialDraft: finalRadiografia,
                    completedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                console.log({
                    executionId,
                    stage: "PREPARE_PAYLOAD_DEBUG",
                    keys: Object.keys(finalPayload),
                    hasDossier: !!finalPayload.dossier,
                    historyLen: Array.isArray(finalPayload.conversationHistory) ? finalPayload.conversationHistory.length : 0
                });
            }
            catch (error) {
                console.error({ executionId, stage: "PREPARE_PAYLOAD", name: error.name, message: error.message, stack: error.stack });
                throw new functions.https.HttpsError("internal", "PREPARE_PAYLOAD_FAILED");
            }
            console.log({ executionId, stage: "RESOLVE_PROSPECT" });
            let resolutionResult;
            try {
                const engine = new ProspectResolutionEngine_1.ProspectResolutionEngine();
                const mergePayload = {
                    companyName: dossierPayload.companyName || linkData.companyName || "Unknown",
                    contactName: dossierPayload.contactName || linkData.contactName || "Unknown",
                    email: linkData.email || "",
                    phone: linkData.phone || "",
                    advisorId: linkData.advisorId,
                    advisorUid: linkData.advisorUid,
                    linkId: linkId,
                    sourceLeadId: linkData.prospectId,
                    origin: types_1.ProspectOrigin.WEBSITE,
                    acquisitionSource: linkData.acquisitionSource || types_1.AcquisitionSource.DIRECT
                };
                if (linkData.advisorId && linkData.advisorId !== "UNKNOWN") {
                    mergePayload.origin = types_1.ProspectOrigin.ADVISOR_SHARE;
                }
                resolutionResult = await engine.resolveProspect(mergePayload, t);
            }
            catch (error) {
                console.error({ executionId, stage: "RESOLVE_PROSPECT", name: error.name, message: error.message, stack: error.stack });
                throw new functions.https.HttpsError("internal", "RESOLVE_PROSPECT_FAILED");
            }
            console.log({ executionId, stage: "WRITE_SESSION", prospectId: resolutionResult.matchedProspectId });
            try {
                finalPayload.prospectId = resolutionResult.matchedProspectId || null;
                const validateFirestorePayload = (obj, path = "") => {
                    if (obj === undefined)
                        throw new Error(`Invalid value: undefined at path ${path}`);
                    if (Number.isNaN(obj))
                        throw new Error(`Invalid value: NaN at path ${path}`);
                    if (obj === Infinity || obj === -Infinity)
                        throw new Error(`Invalid value: Infinity at path ${path}`);
                    if (typeof obj === "function")
                        throw new Error(`Invalid value: function at path ${path}`);
                    if (obj && typeof obj === "object") {
                        if (obj instanceof Date)
                            throw new Error(`Invalid value: Date instance at path ${path}`);
                        if (obj.constructor && obj.constructor.name !== "Object" && obj.constructor.name !== "Array" && obj.constructor.name !== "Timestamp" && obj.constructor.name !== "FieldValue") {
                            throw new Error(`Invalid value: Class instance (${obj.constructor.name}) at path ${path}`);
                        }
                        for (const key in obj) {
                            validateFirestorePayload(obj[key], path ? `${path}.${key}` : key);
                        }
                    }
                };
                try {
                    validateFirestorePayload(finalPayload, "finalPayload");
                }
                catch (validationErr) {
                    console.error({ executionId, stage: "VALIDATE_FIRESTORE_PAYLOAD", name: validationErr.name, message: validationErr.message });
                    throw new functions.https.HttpsError("internal", `INVALID_FIRESTORE_PAYLOAD: ${validationErr.message}`);
                }
                const sessionRef = db.collection("discovery_sessions").doc(dossierId);
                console.log({ executionId, stage: "WRITE_DOSSIER", docPath: sessionRef.path });
                t.set(sessionRef, finalPayload);
                if (linkId !== "demo") {
                    const linkRef = db.collection("market_discovery_links").doc(linkId);
                    console.log({ executionId, stage: "UPDATE_LINK", docPath: linkRef.path });
                    t.update(linkRef, {
                        status: "completed",
                        dossierId: dossierId,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
                if (resolutionResult.matchedProspectId) {
                    const eventRef = db.collection("platform_events").doc();
                    console.log({ executionId, stage: "WRITE_EVENT", docPath: eventRef.path });
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
            }
            catch (error) {
                console.error({ executionId, stage: "WRITE_SESSION", name: error.name, message: error.message, stack: error.stack });
                throw new functions.https.HttpsError("internal", "WRITE_SESSION_FAILED");
            }
            console.log({ executionId, stage: "COMPLETE_TRANSACTION" });
            return {
                dossierId,
                trustDecision,
                prospectId: resolutionResult.matchedProspectId,
                resolutionStatus: resolutionResult.resolutionReason
            };
        });
    }
    catch (err) {
        if (!(err instanceof functions.https.HttpsError)) {
            console.error({ executionId, stage: "COMPLETE_TRANSACTION", name: err.name, message: err.message, stack: err.stack });
            throw new functions.https.HttpsError("internal", "TRANSACTION_FAILED_UNKNOWN");
        }
        throw err;
    }
});
//# sourceMappingURL=completeDiscoverySession.js.map