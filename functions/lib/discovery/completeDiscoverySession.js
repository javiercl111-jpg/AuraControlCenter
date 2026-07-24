"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeDiscoverySession = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const functions_1 = require("firebase-admin/functions");
const discoverySecurityService_1 = require("./discoverySecurityService");
const ProspectResolutionEngine_1 = require("../prospects/ProspectResolutionEngine");
const types_1 = require("../prospects/types");
const DefaultExecutiveDiscoveryAdapter_1 = require("./executive-intelligence/adapter/DefaultExecutiveDiscoveryAdapter");
const ExecutiveDiscoveryApiRequest_1 = require("./executive-intelligence/contracts/ExecutiveDiscoveryApiRequest");
const ExecutiveDiscoveryTransportError_1 = require("./executive-intelligence/contracts/ExecutiveDiscoveryTransportError");
const integration_1 = require("./executive-intelligence/integration");
const discoveryCompletionValidation_1 = require("./discoveryCompletionValidation");
const SHADOW_CONTROLLED_FIELDS = [
    "legacyDiagnosis",
    "shadowDiagnosis",
    "shadowMetadata",
    "shadowExecution",
    "shadowTimestamp",
    "shadowStatus",
    "shadowErrorCode",
    "shadowSafeErrorCode",
    "adapterVersion",
    "capabilityVersion",
];
function withoutShadowControlledFields(payload) {
    const cleanPayload = { ...payload };
    delete cleanPayload.completedAt;
    for (const field of SHADOW_CONTROLLED_FIELDS) {
        delete cleanPayload[field];
    }
    return cleanPayload;
}
/**
 * Shadow authentication is intentionally unavailable in this deployment.
 * Replacing this security gate requires a separate, approved OIDC/IAM rollout.
 */
function createSecurityGatedShadowAdapter() {
    throw new ExecutiveDiscoveryTransportError_1.ExecutiveDiscoveryTransportError({
        code: ExecutiveDiscoveryTransportError_1.ExecutiveDiscoveryTransportErrorCode.AUTHENTICATION_REQUIRED,
        message: "Executive Discovery service authentication is not configured.",
        retryable: false,
    });
}
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
        const requiredFields = ["dossier", "conversationHistory", "conversationStateSnapshot"];
        for (const field of requiredFields) {
            if (dossierPayload[field] === undefined) {
                throw new functions.https.HttpsError("invalid-argument", `Payload validation failed: missing ${field}`);
            }
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
        const transactionResult = await db.runTransaction(async (t) => {
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
                const completion = (0, discoveryCompletionValidation_1.validateDiscoveryCompletion)({
                    dossierPayload,
                    linkData,
                });
                if (!completion.valid) {
                    console.warn({
                        executionId,
                        stage: "VALIDATE_COMPLETION",
                        hardMissingFields: completion.hardMissingFields,
                        evidenceGaps: completion.evidenceGaps,
                        conversationMetrics: completion.conversationMetrics,
                        completionReason: completion.completionReason,
                        missingRequiredFields: completion.missingRequiredFields,
                        conversationDefinitionVersion: completion.conversationDefinitionVersion,
                    });
                    throw new functions.https.HttpsError("failed-precondition", "DISCOVERY_REQUIRED_FIELDS_MISSING", completion);
                }
                console.log({
                    executionId,
                    stage: "DISCOVERY_COMPLETION_VALIDATED",
                    hardMissingCount: completion.hardMissingFields.length,
                    evidenceGapCount: completion.evidenceGaps.length,
                    userTurns: completion.conversationMetrics.userTurns,
                    substantiveUserTurns: completion.conversationMetrics.substantiveUserTurns,
                });
                if (completion.evidenceGaps.length > 0) {
                    console.log({
                        executionId,
                        stage: "DISCOVERY_COMPLETION_EVIDENCE_GAPS",
                        evidenceGaps: completion.evidenceGaps,
                    });
                }
            }
            catch (error) {
                console.error({ executionId, stage: "LOAD_SESSION", name: error.name, message: error.message, stack: error.stack });
                throw error;
            }
            const dossierId = `dossier_${linkId}_${Date.now()}`;
            console.log({ executionId, stage: "PREPARE_PAYLOAD", dossierId });
            let validatedPayload;
            let firestoreWritePayload;
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
                const dossierPayloadClean = withoutShadowControlledFields(dossierPayload);
                const completion = (0, discoveryCompletionValidation_1.validateDiscoveryCompletion)({
                    dossierPayload,
                    linkData,
                });
                validatedPayload = {
                    id: dossierId,
                    linkId,
                    ...dossierPayloadClean,
                    companyName: linkData.companyName,
                    contactName: linkData.contactName,
                    recipientName: linkData.contactName,
                    advisorId: linkData.advisorId || null,
                    questionsAskedCount: completion.questionsAskedCount,
                    completionReason: completion.completionReason,
                    missingRequiredFields: completion.missingRequiredFields,
                    evidenceGaps: completion.evidenceGaps,
                    conversationMetrics: completion.conversationMetrics,
                    conversationDefinitionVersion: completion.conversationDefinitionVersion,
                    ...(dossierPayloadClean.createdAt ? { createdAt: dossierPayloadClean.createdAt } : {}),
                    executiveBriefingDraft: finalExecutiveBriefing,
                    radiografiaEmpresarialDraft: finalRadiografia
                };
                console.log({
                    executionId,
                    stage: "PREPARE_PAYLOAD_DEBUG",
                    keys: Object.keys(validatedPayload),
                    hasDossier: !!validatedPayload.dossier,
                    historyLen: Array.isArray(validatedPayload.conversationHistory) ? validatedPayload.conversationHistory.length : 0
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
                    companyName: linkData.companyName,
                    contactName: linkData.contactName,
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
                validatedPayload.prospectId = resolutionResult.matchedProspectId || null;
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
                    validateFirestorePayload(validatedPayload, "validatedPayload");
                }
                catch (validationErr) {
                    console.error({ executionId, stage: "VALIDATE_FIRESTORE_PAYLOAD", name: validationErr.name, message: validationErr.message });
                    throw new functions.https.HttpsError("internal", `INVALID_FIRESTORE_PAYLOAD: ${validationErr.message}`);
                }
                firestoreWritePayload = {
                    ...validatedPayload,
                    legacyDiagnosis: (0, integration_1.buildLegacyDiscoveryDiagnosis)(validatedPayload),
                    createdAt: validatedPayload.createdAt ? validatedPayload.createdAt : admin.firestore.FieldValue.serverTimestamp(),
                    completedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                const sessionRef = db.collection("discovery_sessions").doc(dossierId);
                console.log({ executionId, stage: "WRITE_DOSSIER", docPath: sessionRef.path });
                t.set(sessionRef, firestoreWritePayload);
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
                    // Update the matched lead with the dossier id
                    const leadRef = db.collection("platform_leads").doc(resolutionResult.matchedProspectId);
                    console.log({ executionId, stage: "UPDATE_LEAD", docPath: leadRef.path });
                    t.update(leadRef, {
                        smartBusinessDossierId: dossierId,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    // Record the attachment event
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
                resolutionStatus: resolutionResult.resolutionReason,
                // Internal fields for notification
                companyName: firestoreWritePayload.companyName || "Unknown",
                prospectName: firestoreWritePayload.contactName || "Unknown",
                advisorUid: linkData.advisorUid || null,
                advisorId: linkData.advisorId || null,
                shadowEvaluationContext: {
                    sessionId: dossierId,
                    linkId,
                    tenantId: linkData.tenantId,
                    organizationId: linkData.organizationId,
                    companyId: resolutionResult.matchedProspectId || linkData.companyId,
                    locale: linkData.locale,
                    trustDecision,
                    capturedAt: new Date().toISOString(),
                    session: validatedPayload,
                    consents: linkData.consents,
                    legacyDiagnosis: firestoreWritePayload.legacyDiagnosis,
                },
            };
        });
        // Transaction completed successfully. Now enqueue notification.
        const returnPayload = {
            dossierId: transactionResult.dossierId,
            trustDecision: transactionResult.trustDecision,
            prospectId: transactionResult.prospectId,
            resolutionStatus: transactionResult.resolutionStatus
        };
        let notificationRecipientUid = null;
        const prospectId = transactionResult.prospectId;
        try {
            // 1. linkData.advisorUid válido
            if (transactionResult.advisorUid && transactionResult.advisorUid !== "UNKNOWN" && transactionResult.advisorUid.trim() !== "") {
                notificationRecipientUid = transactionResult.advisorUid;
            }
            // 2. linkData.advisorId -> resolver UID canónico en platform_sales_advisors
            if (!notificationRecipientUid) {
                if (transactionResult.advisorId && transactionResult.advisorId !== "UNKNOWN" && transactionResult.advisorId.trim() !== "") {
                    const advDoc = await db.collection("platform_sales_advisors").doc(transactionResult.advisorId).get();
                    if (advDoc.exists) {
                        const uid = advDoc.data()?.uid;
                        if (uid && uid !== "UNKNOWN" && uid.trim() !== "") {
                            notificationRecipientUid = uid;
                        }
                    }
                }
            }
            // 3. propietario canónico del prospecto resuelto, si existe
            if (!notificationRecipientUid) {
                if (prospectId) {
                    const prospectDoc = await db.collection("platform_leads").doc(prospectId).get();
                    if (prospectDoc.exists) {
                        const currentAdvisorId = prospectDoc.data()?.currentAdvisorId;
                        if (currentAdvisorId && currentAdvisorId !== "UNASSIGNED" && currentAdvisorId !== "UNKNOWN" && currentAdvisorId.trim() !== "") {
                            const advDoc = await db.collection("platform_sales_advisors").doc(currentAdvisorId).get();
                            if (advDoc.exists) {
                                const uid = advDoc.data()?.uid;
                                if (uid && uid !== "UNKNOWN" && uid.trim() !== "") {
                                    notificationRecipientUid = uid;
                                }
                            }
                        }
                    }
                }
            }
            // 4. Si no existe destinatario -> registrar stage: "NOTIFICATION_SKIPPED_NO_RECIPIENT"
            if (!notificationRecipientUid) {
                console.log({
                    executionId,
                    stage: "NOTIFICATION_SKIPPED_NO_RECIPIENT",
                    linkId,
                    dossierId: transactionResult.dossierId,
                    prospectId: prospectId || null
                });
            }
            else {
                console.log({ executionId, stage: "ENQUEUE_NOTIFICATION", recipientUid: notificationRecipientUid });
                const queue = (0, functions_1.getFunctions)().taskQueue("emitDiscoveryCompletedNotification");
                const notificationPayload = {
                    discoverySessionId: transactionResult.dossierId,
                    dossierId: transactionResult.dossierId,
                    advisorUid: notificationRecipientUid,
                    tenantId: "aura_root",
                    companyName: transactionResult.companyName,
                    prospectName: transactionResult.prospectName,
                    correlationId: executionId,
                    idempotencyKey: `discovery.completed:${transactionResult.dossierId}`
                };
                await queue.enqueue(notificationPayload, { dispatchDeadlineSeconds: 15 });
            }
        }
        catch (enqueueErr) {
            console.error({ executionId, stage: "FAILED_TO_ENQUEUE", error: enqueueErr });
        }
        const shadowCorrelationId = `shadow_${executionId}`;
        const shadowStartedAt = Date.now();
        const shadowFlags = (0, integration_1.resolveDiscoveryEvaluationFeatureFlags)();
        const endpointConfigured = integration_1.executiveDiscoveryEndpointParam.value().trim().length > 0;
        try {
            await (0, integration_1.runDiscoveryShadowEvaluation)({
                context: transactionResult.shadowEvaluationContext,
                correlationId: shadowCorrelationId,
                flags: shadowFlags,
                endpointConfigured,
                authenticationMode: "UNCONFIGURED",
                adapterFactory: createSecurityGatedShadowAdapter,
                persistence: {
                    persist: async (record) => {
                        await db
                            .collection("discovery_sessions")
                            .doc(transactionResult.dossierId)
                            .update({ ...record });
                    },
                },
                logger: {
                    log: (entry) => {
                        console.log({
                            stage: "DISCOVERY_SHADOW_EVALUATION",
                            ...entry,
                        });
                    },
                },
            });
        }
        catch {
            console.error({
                stage: "DISCOVERY_SHADOW_EVALUATION",
                correlationId: shadowCorrelationId,
                durationMs: Math.max(0, Date.now() - shadowStartedAt),
                status: "FAILED",
                capabilityVersion: ExecutiveDiscoveryApiRequest_1.EXECUTIVE_DISCOVERY_CAPABILITY_VERSION,
                adapterVersion: DefaultExecutiveDiscoveryAdapter_1.EXECUTIVE_DISCOVERY_ADAPTER_VERSION,
                safeErrorCode: "SHADOW_INTEGRATION_FAILED",
                adapterStage: "INTEGRATION",
                endpointConfigured,
                authenticationMode: "UNCONFIGURED",
                comparisonStatus: "NOT_REQUESTED",
                persisted: false,
            });
        }
        return returnPayload;
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