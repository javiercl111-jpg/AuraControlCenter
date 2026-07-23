"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestExecutiveDocument = void 0;
exports.getDiscoveryReportSessionScopeFailure = getDiscoveryReportSessionScopeFailure;
exports.authorizeDiscoveryReportSession = authorizeDiscoveryReportSession;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const discoverySecurityService_1 = require("../discoverySecurityService");
const DiscoveryReportGenerationService_1 = require("./DiscoveryReportGenerationService");
const types_1 = require("../../prospects/types");
const resolvePlatformPrincipal_1 = require("../../auth/resolvePlatformPrincipal");
function distinctAuthorityValues(values) {
    return [...new Set(values.filter((value) => typeof value === "string" && value.trim() !== ""))];
}
function getDiscoveryReportSessionScopeFailure(input, nowMillis = Date.now()) {
    if (!input.storedSessionTokenHash || input.storedSessionTokenHash !== input.presentedSessionTokenHash) {
        return "SESSION_TOKEN_INVALID";
    }
    if (input.sessionTokenExpiresAtMillis === null || input.sessionTokenExpiresAtMillis <= nowMillis) {
        return "SESSION_TOKEN_EXPIRED";
    }
    if (input.linkStatus !== "completed") {
        return "DISCOVERY_SESSION_NOT_COMPLETED";
    }
    if (input.linkDossierId !== input.requestedSessionId ||
        input.sessionLinkId !== input.requestedLinkId) {
        return "DISCOVERY_SESSION_MISMATCH";
    }
    if (input.sessionProspectId !== input.requestedProspectId) {
        return "DISCOVERY_PROSPECT_MISMATCH";
    }
    if (distinctAuthorityValues([input.linkTenantId, input.sessionTenantId, input.prospectTenantId]).length > 1) {
        return "DISCOVERY_TENANT_MISMATCH";
    }
    if (distinctAuthorityValues([
        input.linkOrganizationId,
        input.sessionOrganizationId,
        input.prospectOrganizationId,
    ]).length > 1) {
        return "DISCOVERY_ORGANIZATION_MISMATCH";
    }
    return null;
}
function timestampToMillis(value) {
    if (!value || typeof value !== "object")
        return null;
    const timestamp = value;
    if (typeof timestamp.toMillis === "function")
        return timestamp.toMillis();
    if (typeof timestamp.toDate === "function")
        return timestamp.toDate().getTime();
    return null;
}
async function authorizeDiscoveryReportSession(db, input) {
    const { linkId, sessionToken, targetSessionId, targetProspectId } = input;
    if (typeof linkId !== "string" ||
        linkId.length === 0 ||
        linkId.length > 128 ||
        linkId.includes("/") ||
        typeof sessionToken !== "string" ||
        !/^[a-f0-9]{64}$/i.test(sessionToken) ||
        typeof targetSessionId !== "string" ||
        !targetSessionId.startsWith("dossier_") ||
        targetSessionId.length > 256 ||
        targetSessionId.includes("/") ||
        typeof targetProspectId !== "string" ||
        targetProspectId.length === 0 ||
        targetProspectId.length > 128 ||
        targetProspectId.includes("/")) {
        throw new functions.https.HttpsError("invalid-argument", "INVALID_DISCOVERY_REPORT_SCOPE");
    }
    const [linkSnap, sessionSnap, prospectSnap] = await Promise.all([
        db.collection("market_discovery_links").doc(linkId).get(),
        db.collection("discovery_sessions").doc(targetSessionId).get(),
        db.collection("platform_leads").doc(targetProspectId).get(),
    ]);
    if (!linkSnap.exists || !sessionSnap.exists || !prospectSnap.exists) {
        throw new functions.https.HttpsError("permission-denied", "DISCOVERY_REPORT_SCOPE_NOT_FOUND");
    }
    const linkData = linkSnap.data();
    const sessionData = sessionSnap.data();
    const prospectData = prospectSnap.data();
    const presentedSessionTokenHash = (0, discoverySecurityService_1.generateTokenHash)(sessionToken);
    const failure = getDiscoveryReportSessionScopeFailure({
        storedSessionTokenHash: linkData.sessionTokenHash,
        presentedSessionTokenHash,
        sessionTokenExpiresAtMillis: timestampToMillis(linkData.sessionTokenExpiresAt || linkData.expiresAt),
        linkStatus: linkData.status,
        linkDossierId: linkData.dossierId,
        requestedSessionId: targetSessionId,
        requestedProspectId: targetProspectId,
        sessionLinkId: sessionData.linkId,
        requestedLinkId: linkId,
        sessionProspectId: sessionData.prospectId,
        linkTenantId: linkData.tenantId,
        sessionTenantId: sessionData.tenantId,
        prospectTenantId: prospectData.tenantId,
        linkOrganizationId: linkData.organizationId,
        sessionOrganizationId: sessionData.organizationId,
        prospectOrganizationId: prospectData.organizationId,
    });
    if (failure) {
        throw new functions.https.HttpsError("permission-denied", "DISCOVERY_REPORT_ACCESS_DENIED", {
            safeErrorCode: failure,
        });
    }
    return {
        linkId,
        sessionId: targetSessionId,
        prospectId: targetProspectId,
        tenantId: distinctAuthorityValues([linkData.tenantId, sessionData.tenantId, prospectData.tenantId])[0] || "aura_root",
        organizationId: distinctAuthorityValues([
            linkData.organizationId,
            sessionData.organizationId,
            prospectData.organizationId,
        ])[0] || targetProspectId,
    };
}
exports.requestExecutiveDocument = functions.https.onCall(async (request) => {
    if (request.app == undefined) {
        throw new functions.https.HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
    }
    const { reportId, linkId, sessionToken, forceRegenerate } = request.data;
    if (typeof reportId !== "string" ||
        reportId.length === 0 ||
        reportId.length > 384 ||
        reportId.includes("/")) {
        throw new functions.https.HttpsError("invalid-argument", "Missing reportId.");
    }
    const db = admin.firestore();
    const metadataRef = db.collection("discovery_reports").doc(reportId);
    const metadataSnap = await metadataRef.get();
    let isProspect;
    let allowedReportTypes;
    let userContext;
    if (!metadataSnap.exists) {
        // If it doesn't exist, we must know prospectId and sessionId to regenerate.
        // We shouldn't blindly regenerate if we don't have authorization.
        // We will just throw not-found for now, but wait! The user said:
        // "Si el documento no existe -> Regenerarlo -> Esperar -> Actualizar metadata -> Continuar. No regresar 404."
        // BUT how do we know the prospectId and sessionId if metadata doesn't exist?
        // Wait! The DiscoverPage and CRM both know the sessionId and prospectId, but they only send `reportId`.
        // Wait, the instructions say:
        // "Resolución del Reporte: Si se recibe reportId: validar que pertenece a esa sessionId y prospectId; rechazar cualquier mismatch."
        // If the metadata doesn't exist at all, we can't validate it against sessionId/prospectId from the link!
        // UNLESS the reportId is formatted as `${sessionId}_${reportType}_v${documentVersion}`!
        // Yes! reportId = `${sessionId}_${reportType}_v${documentVersion}`
        // So we can extract sessionId and reportType from reportId!
    }
    // Parse reportId: e.g. dossier_8QF2L_123456_EXTERNAL_RADIOGRAFIA_v1.0
    // Or more safely, require frontend to pass prospectId and sessionId if not exists?
    // Let's assume metadata ALWAYS exists if it was generated. If they request a completely fake reportId, we can reject.
    // Wait, if it doesn't exist in metadata, we can extract sessionId from reportId.
    // reportId format is `${sessionId}_${reportType}_v${documentVersion}`
    let targetSessionId;
    let targetProspectId;
    let targetReportType;
    if (metadataSnap.exists) {
        const data = metadataSnap.data();
        targetSessionId = data.sessionId;
        targetProspectId = data.prospectId;
        targetReportType = data.reportType;
    }
    else {
        // Attempt to parse reportId
        // format: sessionId_reportType_vVersion
        // sessionId itself might have underscores (e.g. dossier_8QF2L_123456)
        const match = reportId.match(/^(.*)_(EXTERNAL_RADIOGRAFIA|INTERNAL_BRIEFING)_v([0-9.]+)$/);
        if (!match) {
            throw new functions.https.HttpsError("not-found", "Document metadata not found and invalid ID format.");
        }
        targetSessionId = match[1];
        targetReportType = match[2];
        // We still need prospectId. We can get it from discovery_sessions -> prospectId
        const sessionSnap = await db.collection("discovery_sessions").doc(targetSessionId).get();
        if (!sessionSnap.exists) {
            throw new functions.https.HttpsError("not-found", "Session not found.");
        }
        targetProspectId = sessionSnap.data().prospectId || "UNKNOWN";
    }
    // ---------------------------------------------------------
    // 1. Authorization Logic
    // ---------------------------------------------------------
    if (sessionToken || linkId) {
        // Prospect flow
        isProspect = true;
        const scope = await authorizeDiscoveryReportSession(db, {
            linkId,
            sessionToken,
            targetSessionId,
            targetProspectId,
        });
        allowedReportTypes = ["EXTERNAL_RADIOGRAFIA"];
        userContext = `PROSPECT_${scope.linkId}`;
    }
    else if (request.auth) {
        // CRM flow
        isProspect = false;
        const caller = await (0, resolvePlatformPrincipal_1.resolvePlatformPrincipal)(db, request.auth);
        const allowedAdminRoles = ["FOUNDER", "SUPER_ADMIN", "SALES_DIRECTOR", "PLATFORM_OWNER", "PLATFORM_PARTNER", "PARTNER"];
        const isGlobalAdmin = allowedAdminRoles.includes(caller.role);
        const isAdvisor = caller.role === "SALES_ADVISOR";
        if (isGlobalAdmin) {
            allowedReportTypes = ["EXTERNAL_RADIOGRAFIA", "INTERNAL_BRIEFING"];
            userContext = `ADMIN_${caller.id}`;
        }
        else if (isAdvisor) {
            const advisorId = caller.advisorId || caller.id;
            // Check if advisor owns the prospect
            const prospectSnap = await db.collection("platform_leads").doc(targetProspectId).get();
            if (prospectSnap.exists && prospectSnap.data()?.currentAdvisorId === advisorId) {
                allowedReportTypes = ["EXTERNAL_RADIOGRAFIA", "INTERNAL_BRIEFING"];
                userContext = `ADVISOR_${advisorId}`;
            }
            else {
                throw new functions.https.HttpsError("permission-denied", "Advisor does not own this prospect.");
            }
        }
        else {
            throw new functions.https.HttpsError("permission-denied", "User is not authorized.");
        }
    }
    else {
        throw new functions.https.HttpsError("unauthenticated", "Authentication or session token required.");
    }
    // ---------------------------------------------------------
    // 2. Validate Report Type
    // ---------------------------------------------------------
    if (!allowedReportTypes.includes(targetReportType)) {
        throw new functions.https.HttpsError("permission-denied", "You are not allowed to request this report type.");
    }
    // ---------------------------------------------------------
    // 3. Force Regenerate Logic
    // ---------------------------------------------------------
    let shouldForceRegenerate = false;
    if (forceRegenerate === true) {
        if (userContext.startsWith("ADMIN_")) {
            shouldForceRegenerate = true;
        }
        else {
            throw new functions.https.HttpsError("permission-denied", "Only administrators can force regenerate.");
        }
    }
    // ---------------------------------------------------------
    // 4. Generate or Verify Document
    // ---------------------------------------------------------
    try {
        const generationResult = await DiscoveryReportGenerationService_1.DiscoveryReportGenerationService.generateReport(targetSessionId, targetProspectId, targetReportType, shouldForceRegenerate);
        const finalMetadata = generationResult.metadata;
        if (!finalMetadata) {
            throw new functions.https.HttpsError("internal", "Generation service did not return metadata.");
        }
        if (finalMetadata.status === "REVOKED") {
            return {
                status: "REVOKED",
                safeErrorCode: "DOCUMENT_REVOKED"
            };
        }
        if (finalMetadata.status === "GENERATING") {
            return {
                status: "GENERATING",
                retryAfterSeconds: 5
            };
        }
        if (finalMetadata.status === "ERROR") {
            return {
                status: "ERROR",
                retryAfterSeconds: 30
            };
        }
        // ---------------------------------------------------------
        // 5. Generate Signed URL
        // ---------------------------------------------------------
        if (finalMetadata.status === "READY") {
            // Check if file physically exists in storage
            const bucket = admin.storage().bucket();
            const file = bucket.file(finalMetadata.storagePath);
            const [exists] = await file.exists();
            if (!exists) {
                // Archivo físico faltante. Necesitamos forzar regeneración.
                console.warn(`File missing in storage for READY report ${reportId}. Regenerating...`);
                const regenResult = await DiscoveryReportGenerationService_1.DiscoveryReportGenerationService.generateReport(targetSessionId, targetProspectId, targetReportType, true // force
                );
                if (regenResult.metadata?.status === "READY") {
                    // We'll proceed to generate URL below
                }
                else {
                    return {
                        status: "GENERATING",
                        retryAfterSeconds: 5
                    };
                }
            }
            // Re-fetch file reference if we regenerated
            const finalFile = bucket.file(finalMetadata.storagePath);
            // Get TTL from config, default 10
            let ttlMinutes = 10;
            const settingsSnap = await db.collection("platform_settings").doc("discovery_security").get();
            if (settingsSnap.exists) {
                ttlMinutes = settingsSnap.data()?.executiveDocumentDownloadTtlMinutes || 10;
                if (ttlMinutes < 5)
                    ttlMinutes = 5;
                if (ttlMinutes > 30)
                    ttlMinutes = 30;
            }
            const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
            const [downloadUrl] = await finalFile.getSignedUrl({
                action: 'read',
                expires: expiresAt,
                promptSaveAs: `${targetReportType.toLowerCase()}.pdf`
            });
            // ---------------------------------------------------------
            // 6. Audit Logging
            // ---------------------------------------------------------
            const eventRef = db.collection("platform_events").doc();
            await eventRef.set({
                eventId: eventRef.id,
                type: types_1.LifecycleEventType.DISCOVERY_REPORT_DELIVERED,
                prospectId: targetProspectId,
                sessionId: targetSessionId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                actorType: isProspect ? "PROSPECT" : "ADVISOR_ADMIN",
                source: "requestExecutiveDocument",
                metadata: {
                    reportId: finalMetadata.reportId,
                    reportType: finalMetadata.reportType,
                    documentVersion: finalMetadata.documentVersion,
                    requestedByType: isProspect ? "PROSPECT" : "ADVISOR_ADMIN",
                    deliveryMethod: "SIGNED_URL",
                    expiresAt: new Date(expiresAt).toISOString()
                }
            });
            return {
                status: "READY",
                reportId: finalMetadata.reportId,
                reportType: finalMetadata.reportType,
                documentVersion: finalMetadata.documentVersion,
                downloadUrl,
                expiresAt: new Date(expiresAt).toISOString(),
                generatedAt: finalMetadata.generatedAt
            };
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "EXECUTIVE_DOCUMENT_REQUEST_FAILED";
        if (errorMessage === "DOCUMENT_REVOKED") {
            return {
                status: "REVOKED",
                safeErrorCode: "DOCUMENT_REVOKED"
            };
        }
        // Log error event
        const eventRef = db.collection("platform_events").doc();
        await eventRef.set({
            eventId: eventRef.id,
            type: "DISCOVERY_REPORT_DOWNLOAD_FAILED",
            prospectId: targetProspectId,
            sessionId: targetSessionId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            actorType: isProspect ? "PROSPECT" : "ADVISOR_ADMIN",
            source: "requestExecutiveDocument",
            metadata: { reportId, error: errorMessage }
        });
        throw new functions.https.HttpsError("internal", errorMessage);
    }
    return { status: "ERROR", retryAfterSeconds: 10 };
});
//# sourceMappingURL=requestExecutiveDocument.js.map