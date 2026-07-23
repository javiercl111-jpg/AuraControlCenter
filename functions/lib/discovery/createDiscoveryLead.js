"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDiscoveryLead = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const discoverySecurityService_1 = require("./discoverySecurityService");
const idempotencyHelper_1 = require("./idempotencyHelper");
const params_1 = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const resolvePlatformPrincipal_1 = require("../auth/resolvePlatformPrincipal");
const idempotencySecret = (0, params_1.defineSecret)("IDEMPOTENCY_SECRET");
exports.createDiscoveryLead = (0, https_1.onCall)({
    region: "us-central1",
    enforceAppCheck: true,
    secrets: [idempotencySecret],
}, async (request) => {
    try {
        if (request.app == undefined) {
            throw new https_1.HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
        }
        const payload = request.data;
        if (!payload) {
            throw new https_1.HttpsError("invalid-argument", "INVALID_INPUT");
        }
        if (JSON.stringify(payload).length > 5000) {
            throw new https_1.HttpsError("out-of-range", "Payload too large.");
        }
        // 1. Extract & Sanitize
        const companyName = (payload.companyName || "").substring(0, 100).trim();
        const contactName = (payload.contactName || "").substring(0, 100).trim();
        const email = (payload.email || "").toLowerCase().trim();
        const phone = (payload.phone || "").substring(0, 20).trim();
        const jobTitle = (payload.jobTitle || payload.role || "").substring(0, 50).trim();
        const state = (payload.state || payload.location || "").substring(0, 50).trim();
        const city = (payload.city || "").substring(0, 50).trim();
        const employeeRange = (payload.employeeRange || "").substring(0, 50).trim();
        const commercialCode = (payload.commercialCode || "").substring(0, 20).toUpperCase().trim();
        const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey.trim() : "";
        let origin = payload.origin === "WEBSITE" ? "WEBSITE" : "ADVISOR_SHARE";
        if (payload.origin === "AURA_NEXUS" || payload.origin === "WEBSITE") {
            origin = payload.origin;
        }
        const acquisitionSource = payload.acquisitionSource === "AURA_NEXUS" ? "AURA_NEXUS" : "DIRECT";
        // 2. Validate Consents
        let privacyConsent = false;
        let diagnosticDeliveryConsent = false;
        let followUpConsent = false;
        let marketingConsent = false;
        const policyVersion = payload.policyVersion || "legacy-v1";
        if (typeof payload.consent === "boolean" && payload.consent) {
            privacyConsent = true;
            diagnosticDeliveryConsent = true;
            followUpConsent = false;
            marketingConsent = false;
        }
        else {
            privacyConsent = payload.privacyConsent === true;
            diagnosticDeliveryConsent = payload.diagnosticDeliveryConsent === true;
            followUpConsent = payload.followUpConsent === true;
            marketingConsent = payload.marketingConsent === true;
        }
        if (!companyName || !contactName || !email) {
            throw new https_1.HttpsError("invalid-argument", "INVALID_INPUT");
        }
        if (!privacyConsent || !diagnosticDeliveryConsent) {
            throw new https_1.HttpsError("invalid-argument", "INVALID_INPUT");
        }
        if (!/^[A-Za-z0-9._:-]{16,100}$/.test(idempotencyKey)) {
            throw new https_1.HttpsError("invalid-argument", "INVALID_INPUT");
        }
        const idempotencyHash = (0, idempotencyHelper_1.generateIdempotencyHash)(idempotencyKey, idempotencySecret.value());
        const requestHash = (0, idempotencyHelper_1.generateRequestHash)({
            ...payload,
            companyName,
            contactName,
            email,
            phone,
            jobTitle,
            state,
            city,
            employeeRange,
            commercialCode,
            origin,
            acquisitionSource,
            privacyConsent,
            diagnosticDeliveryConsent,
            followUpConsent,
            marketingConsent,
            policyVersion,
        });
        const db = admin.firestore();
        const idempotencyRef = db.collection("discovery_intake_idempotency").doc(idempotencyHash);
        // 3. Resolve Advisor
        let advisorContext = null;
        if (commercialCode) {
            const q = await db.collection("advisor_commercial_codes").doc(commercialCode).get();
            if (q.exists && q.data()?.status === "ACTIVE") {
                const advId = q.data()?.advisorId;
                if (advId) {
                    const advSnap = await db.collection("platform_sales_advisors").doc(advId).get();
                    if (advSnap.exists && advSnap.data()?.advisorStatus === "ACTIVE") {
                        advisorContext = { id: advSnap.id, ...advSnap.data() };
                        origin = "ADVISOR_SHARE";
                    }
                }
            }
        }
        const config = await (0, discoverySecurityService_1.getDiscoverySecurityConfig)();
        let authCaller = null;
        if (request.auth) {
            authCaller = await (0, resolvePlatformPrincipal_1.resolvePlatformPrincipal)(db, request.auth);
        }
        const allowedRoles = ["SALES_ADVISOR", "PLATFORM_PARTNER", "SALES_DIRECTOR", "PLATFORM_OWNER", "FOUNDER", "SUPER_ADMIN", "PARTNER"];
        const isAuthorizedCaller = authCaller !== null && allowedRoles.includes(authCaller.role);
        const existingIdempotencySnap = await idempotencyRef.get();
        const existingIdempotencyData = existingIdempotencySnap.data();
        const isKnownRetry = existingIdempotencySnap.exists &&
            existingIdempotencyData?.requestHash === requestHash &&
            ["PROCESSING", "COMPLETED"].includes(existingIdempotencyData?.status);
        // A retry of an already accepted commercial attempt must not be rejected by
        // a rate limit caused by the original successful creation.
        if (!isKnownRetry) {
            const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
            let recentCount = 0;
            if (isAuthorizedCaller && authCaller) {
                const advisorUid = authCaller.uid || request.auth.uid;
                const advisorLimitCheck = await db.collection("market_discovery_links")
                    .where("createdByUid", "==", advisorUid)
                    .get();
                advisorLimitCheck.forEach(doc => {
                    const data = doc.data();
                    if (data.createdAt && data.createdAt.toDate() > cutoff) {
                        recentCount++;
                    }
                });
                if (recentCount >= config.maxLinksPerAdvisorPerDay) {
                    throw new https_1.HttpsError("resource-exhausted", "RATE_LIMITED");
                }
            }
            else {
                // Query by email only to avoid missing composite index
                const emailLimitCheck = await db.collection("market_discovery_links")
                    .where("email", "==", email)
                    .get();
                emailLimitCheck.forEach(doc => {
                    const data = doc.data();
                    if (data.createdAt && data.createdAt.toDate() > cutoff) {
                        recentCount++;
                    }
                });
                if (recentCount >= config.maxSessionsPerEmail) {
                    throw new https_1.HttpsError("resource-exhausted", "RATE_LIMITED");
                }
            }
        }
        // 4. Idempotency Transaction
        let transactionResult;
        const processingAttemptId = (0, discoverySecurityService_1.generateOpaqueToken)();
        try {
            transactionResult = await db.runTransaction(async (t) => {
                const idempSnap = await t.get(idempotencyRef);
                if (idempSnap.exists) {
                    const idempData = idempSnap.data();
                    if (idempData.requestHash !== requestHash) {
                        throw new Error("IDEMPOTENCY_CONFLICT");
                    }
                    if (idempData.status === "PROCESSING") {
                        // Check if lease expired (e.g. 1 minute)
                        const leaseExpired = idempData.processingLeaseExpiresAt && idempData.processingLeaseExpiresAt.toDate() < new Date();
                        if (!leaseExpired) {
                            throw new Error("PROCESSING");
                        }
                    }
                    else if (idempData.status === "COMPLETED") {
                        // Let's resolve the access
                        return { type: "CACHED", idempData };
                    }
                    else if (idempData.status === "FAILED_FINAL") {
                        throw new Error("FAILED_FINAL");
                    }
                }
                // Lock for processing
                t.set(idempotencyRef, {
                    status: "PROCESSING",
                    requestHash,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    processingLeaseExpiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 60000)),
                    processingAttemptId,
                    attemptCount: admin.firestore.FieldValue.increment(1)
                }, { merge: true });
                return { type: "NEW", processingAttemptId };
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "UNKNOWN";
            if (errorMessage === "IDEMPOTENCY_CONFLICT") {
                throw new https_1.HttpsError("already-exists", "IDEMPOTENCY_CONFLICT");
            }
            if (errorMessage === "PROCESSING") {
                return { status: "PROCESSING", retryAfterSeconds: 3 };
            }
            if (errorMessage === "FAILED_FINAL") {
                throw new https_1.HttpsError("internal", "Error procesando solicitud previamente.");
            }
            throw error;
        }
        if (transactionResult.type === "CACHED") {
            const linkSnap = await db.collection("market_discovery_links").doc(transactionResult.idempData.linkId).get();
            if (!linkSnap.exists) {
                throw new https_1.HttpsError("internal", "Link no encontrado.");
            }
            const linkData = linkSnap.data();
            if (linkData.usageCount > 0) {
                return {
                    status: "ERROR",
                    nextAction: "SHOW_REVIEW_PENDING",
                    publicMessage: "Este enlace ya fue consumido. No se generará otro prospecto."
                };
            }
            // Generate a new opaque token (re-issue controlled) since we don't store the old opaque token
            const newOneTimeToken = (0, discoverySecurityService_1.generateOpaqueToken)();
            const newHash = (0, discoverySecurityService_1.generateTokenHash)(newOneTimeToken);
            const expiresAt = linkData.expiresAt.toDate().getTime();
            if (expiresAt < Date.now()) {
                return {
                    status: "ERROR",
                    nextAction: "SHOW_REVIEW_PENDING",
                    publicMessage: "Este enlace ha expirado."
                };
            }
            await linkSnap.ref.update({
                tokenHash: newHash,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            const discoveryUrl = `https://controlcenter.auranexus.io/discover/${linkSnap.id}#access=${newOneTimeToken}`;
            return {
                status: "SUCCESS",
                nextAction: "REDIRECT_DISCOVERY",
                discoveryUrl,
                linkId: linkSnap.id,
                oneTimeToken: newOneTimeToken,
                advisorDisplayName: advisorContext ? (advisorContext.displayName || advisorContext.name) : undefined,
                organizationProfile: "UNKNOWN",
                requiresManualReview: linkData.trustScore?.decision === "REQUIRE_MANUAL_REVIEW"
            };
        }
        // 5. Proceed with Creation
        const trustScoreResult = await (0, discoverySecurityService_1.computeTrustScore)(email, advisorContext, acquisitionSource);
        const oneTimeToken = (0, discoverySecurityService_1.generateOpaqueToken)();
        const tokenHash = (0, discoverySecurityService_1.generateTokenHash)(oneTimeToken);
        const expirationDate = new Date(Date.now() + config.tokenExpirationHours * 60 * 60 * 1000);
        const consentsPayload = {
            privacy: { value: privacyConsent, capturedAt: new Date().toISOString(), policyVersion, source: "AURA_NEXUS", origin },
            diagnosticDelivery: { value: diagnosticDeliveryConsent, capturedAt: new Date().toISOString(), policyVersion, source: "AURA_NEXUS", origin },
            followUp: { value: followUpConsent, capturedAt: new Date().toISOString(), policyVersion, source: "AURA_NEXUS", origin },
            marketing: { value: marketingConsent, capturedAt: new Date().toISOString(), policyVersion, source: "AURA_NEXUS", origin },
        };
        const linkPayload = {
            companyName,
            contactName,
            email,
            phone,
            jobTitle,
            role: jobTitle,
            state,
            location: state,
            city,
            employeeRange,
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: "createDiscoveryLead_function",
            origin,
            acquisitionSource,
            tokenHash,
            expiresAt: admin.firestore.Timestamp.fromDate(expirationDate),
            usageCount: 0,
            trustScore: trustScoreResult,
            consents: consentsPayload
        };
        if (isAuthorizedCaller && authCaller) {
            linkPayload.advisorUid = authCaller.uid || request.auth.uid;
            if (authCaller.advisorId) {
                linkPayload.advisorId = authCaller.advisorId;
                linkPayload.originalAdvisorId = authCaller.advisorId;
                linkPayload.currentAdvisorId = authCaller.advisorId;
            }
            linkPayload.originalAdvisorUid = authCaller.uid || request.auth.uid;
            linkPayload.currentAdvisorUid = authCaller.uid || request.auth.uid;
            linkPayload.createdByUid = request.auth.uid;
            linkPayload.createdByRole = authCaller.role;
            linkPayload.assignmentType = "ORIGIN";
            linkPayload.attributedAt = admin.firestore.FieldValue.serverTimestamp();
            linkPayload.attributionSource = "DISCOVERY_CRM_CREATE";
        }
        else if (advisorContext) {
            linkPayload.assignmentType = "ORIGIN";
            linkPayload.originalAdvisorId = advisorContext.id;
            linkPayload.originalAdvisorUid = advisorContext.uid;
            linkPayload.currentAdvisorId = advisorContext.id;
            linkPayload.currentAdvisorUid = advisorContext.uid;
            linkPayload.commercialCode = commercialCode;
            linkPayload.attributedAt = admin.firestore.FieldValue.serverTimestamp();
            linkPayload.attributionSource = "DISCOVERY_PRE_FORM";
            linkPayload.advisorUid = advisorContext.uid;
            linkPayload.advisorId = advisorContext.id;
        }
        else {
            linkPayload.assignmentType = "UNASSIGNED";
        }
        const docRef = db.collection("market_discovery_links").doc();
        // Persist the lead and complete its idempotency record atomically. A stale
        // worker cannot create a second lead after another retry acquires the lease.
        await db.runTransaction(async (transaction) => {
            const idempSnap = await transaction.get(idempotencyRef);
            const idempData = idempSnap.data();
            if (!idempSnap.exists ||
                idempData?.status !== "PROCESSING" ||
                idempData?.requestHash !== requestHash ||
                idempData?.processingAttemptId !== transactionResult.processingAttemptId) {
                throw new https_1.HttpsError("aborted", "IDEMPOTENCY_LEASE_LOST");
            }
            transaction.set(docRef, linkPayload);
            transaction.update(idempotencyRef, {
                status: "COMPLETED",
                linkId: docRef.id,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
                processingLeaseExpiresAt: admin.firestore.FieldValue.delete(),
                processingAttemptId: admin.firestore.FieldValue.delete(),
            });
        });
        const discoveryUrl = `https://controlcenter.auranexus.io/discover/${docRef.id}#access=${oneTimeToken}`;
        return {
            status: "SUCCESS",
            nextAction: "REDIRECT_DISCOVERY",
            discoveryUrl,
            linkId: docRef.id,
            oneTimeToken,
            advisorDisplayName: advisorContext ? (advisorContext.displayName || advisorContext.name) : undefined,
            organizationProfile: "UNKNOWN",
            requiresManualReview: trustScoreResult.decision === "REQUIRE_MANUAL_REVIEW"
        };
    }
    catch (error) {
        const errorDetails = error instanceof Error
            ? { message: error.message, code: error.code, stack: error.stack }
            : { message: "UNKNOWN", code: undefined, stack: undefined };
        logger.error("Unhandled error in createDiscoveryLead", {
            message: errorDetails.message,
            code: errorDetails.code,
            stack: errorDetails.stack,
        });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", "INTERNAL");
    }
});
//# sourceMappingURL=createDiscoveryLead.js.map