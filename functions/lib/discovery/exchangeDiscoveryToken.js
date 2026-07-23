"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeDiscoveryToken = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const discoverySecurityService_1 = require("./discoverySecurityService");
exports.exchangeDiscoveryToken = functions.https.onCall(async (request) => {
    if (request.app == undefined) {
        throw new functions.https.HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
    }
    const { linkId, oneTimeToken } = request.data;
    if (typeof linkId !== "string" ||
        linkId.length > 128 ||
        linkId.includes("/") ||
        typeof oneTimeToken !== "string" ||
        !/^[a-f0-9]{64}$/i.test(oneTimeToken)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid linkId or oneTimeToken.");
    }
    const db = admin.firestore();
    const linkRef = db.collection("market_discovery_links").doc(linkId);
    const sessionAccessToken = (0, discoverySecurityService_1.generateOpaqueToken)();
    const sessionTokenHash = (0, discoverySecurityService_1.generateTokenHash)(sessionAccessToken);
    const linkData = await db.runTransaction(async (transaction) => {
        const linkSnap = await transaction.get(linkRef);
        if (!linkSnap.exists) {
            throw new functions.https.HttpsError("not-found", "Link not found.");
        }
        const currentLinkData = linkSnap.data();
        if (currentLinkData.status !== "pending") {
            throw new functions.https.HttpsError("failed-precondition", "Link is no longer pending.");
        }
        if (currentLinkData.tokenHash !== (0, discoverySecurityService_1.generateTokenHash)(oneTimeToken)) {
            throw new functions.https.HttpsError("permission-denied", "Invalid token.");
        }
        const expiresAt = currentLinkData.expiresAt;
        if (!expiresAt || typeof expiresAt.toMillis !== "function" || expiresAt.toMillis() <= Date.now()) {
            throw new functions.https.HttpsError("failed-precondition", "Token has expired.");
        }
        if (typeof currentLinkData.usageCount !== "number" || currentLinkData.usageCount !== 0) {
            throw new functions.https.HttpsError("failed-precondition", "Token already used.");
        }
        transaction.update(linkRef, {
            usageCount: 1,
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
            sessionTokenHash,
            sessionTokenExpiresAt: expiresAt,
            tokenHash: admin.firestore.FieldValue.delete(),
        });
        return currentLinkData;
    });
    return {
        sessionAccessToken,
        linkId,
        trustScoreDecision: linkData.trustScore?.decision || "ALLOW_FULL",
        companyName: linkData.companyName,
        contactName: linkData.contactName
    };
});
//# sourceMappingURL=exchangeDiscoveryToken.js.map