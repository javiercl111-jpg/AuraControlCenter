"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDiscoveryLead = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const discoverySecurityService_1 = require("./discoverySecurityService");
exports.createDiscoveryLead = functions.https.onCall(async (request) => {
    // App Check validation
    if (request.app == undefined) {
        throw new functions.https.HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
    }
    const { companyName, contactName, email, phone, role, location, commercialCode, consent, acquisitionSource } = request.data;
    if (!companyName || !contactName || !email || consent !== true) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required fields or consent.");
    }
    if (JSON.stringify(request.data).length > 5000) {
        throw new functions.https.HttpsError("out-of-range", "Payload too large.");
    }
    const db = admin.firestore();
    let advisorContext = null;
    // Resolve Advisor
    if (commercialCode) {
        const q = await db.collection("platform_sales_advisors")
            .where("commercialCode", "==", commercialCode)
            .where("advisorStatus", "==", "ACTIVE")
            .limit(1)
            .get();
        if (!q.empty) {
            advisorContext = { id: q.docs[0].id, ...q.docs[0].data() };
        }
    }
    const config = await (0, discoverySecurityService_1.getDiscoverySecurityConfig)();
    // Rate limits check (Basic email check)
    const emailLimitCheck = await db.collection("market_discovery_links")
        .where("email", "==", email)
        .where("createdAt", ">", new Date(Date.now() - 24 * 60 * 60 * 1000))
        .get();
    if (emailLimitCheck.size >= config.maxSessionsPerEmail) {
        throw new functions.https.HttpsError("resource-exhausted", "RATE_LIMITED");
    }
    const origin = advisorContext ? "ADVISOR_SHARE" : "WEBSITE";
    const acqSource = acquisitionSource || "DIRECT";
    const trustScoreResult = await (0, discoverySecurityService_1.computeTrustScore)(email, advisorContext, acqSource);
    const oneTimeToken = (0, discoverySecurityService_1.generateOpaqueToken)();
    const tokenHash = (0, discoverySecurityService_1.generateTokenHash)(oneTimeToken);
    const expirationDate = new Date(Date.now() + config.tokenExpirationHours * 60 * 60 * 1000);
    const payload = {
        companyName,
        contactName,
        email,
        phone: phone || "",
        role: role || "",
        location: location || "",
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: "createDiscoveryLead_function",
        origin,
        acquisitionSource: acqSource,
        tokenHash,
        expiresAt: admin.firestore.Timestamp.fromDate(expirationDate),
        usageCount: 0,
        trustScore: trustScoreResult
    };
    if (advisorContext) {
        payload.assignmentType = "ORIGIN";
        payload.originalAdvisorId = advisorContext.id;
        payload.originalAdvisorUid = advisorContext.uid;
        payload.currentAdvisorId = advisorContext.id;
        payload.currentAdvisorUid = advisorContext.uid;
        payload.commercialCode = advisorContext.commercialCode;
        payload.attributedAt = admin.firestore.FieldValue.serverTimestamp();
        payload.attributionSource = "DISCOVERY_PRE_FORM";
    }
    else {
        payload.assignmentType = "UNASSIGNED";
    }
    const docRef = await db.collection("market_discovery_links").add(payload);
    return {
        linkId: docRef.id,
        oneTimeToken,
        trustScoreDecision: trustScoreResult.decision,
        expiresAt: expirationDate.toISOString()
    };
});
//# sourceMappingURL=createDiscoveryLead.js.map