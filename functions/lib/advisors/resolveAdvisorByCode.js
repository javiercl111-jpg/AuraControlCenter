"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAdvisorByCode = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const discoverySecurityService_1 = require("../discovery/discoverySecurityService");
const params_1 = require("firebase-functions/params");
const ipHashSalt = (0, params_1.defineSecret)("IP_HASH_SALT");
exports.resolveAdvisorByCode = (0, https_1.onCall)({
    region: "us-central1",
    enforceAppCheck: true,
    secrets: [ipHashSalt],
}, async (request) => {
    // 1. IP Rate Limiting
    const ipHash = (0, discoverySecurityService_1.generateIpHash)(request.rawRequest?.ip, ipHashSalt.value());
    try {
        // Limit to 10 attempts per hour per IP
        await (0, discoverySecurityService_1.checkIpRateLimit)(ipHash, 10, 60 * 60 * 1000);
    }
    catch (e) {
        if (e.message === "RATE_LIMITED") {
            throw new https_1.HttpsError("resource-exhausted", "RATE_LIMITED");
        }
        throw new https_1.HttpsError("internal", "Error en el servidor");
    }
    const { commercialCode } = request.data;
    if (!commercialCode || typeof commercialCode !== "string") {
        throw new https_1.HttpsError("invalid-argument", "INVALID_INPUT");
    }
    const normalizedCode = commercialCode.trim().toUpperCase();
    if (normalizedCode.length < 3 || normalizedCode.length > 20) {
        return {
            status: "INVALID",
            publicMessage: "No pudimos validar el contexto del consultor."
        };
    }
    const db = admin.firestore();
    // O(1) canonical reservation lookup
    const codeRef = db.collection("advisor_commercial_codes").doc(normalizedCode);
    const codeSnap = await codeRef.get();
    if (!codeSnap.exists) {
        return {
            status: "INVALID",
            publicMessage: "No pudimos validar el contexto del consultor."
        };
    }
    const codeData = codeSnap.data();
    if (codeData.status !== "ACTIVE") {
        return {
            status: "INVALID",
            publicMessage: "No pudimos validar el contexto del consultor."
        };
    }
    const advisorId = codeData.advisorId;
    if (!advisorId) {
        return {
            status: "INVALID",
            publicMessage: "No pudimos validar el contexto del consultor."
        };
    }
    // Read the advisor profile
    const advisorRef = db.collection("platform_sales_advisors").doc(advisorId);
    const advisorSnap = await advisorRef.get();
    if (!advisorSnap.exists) {
        return {
            status: "INVALID",
            publicMessage: "No pudimos validar el contexto del consultor."
        };
    }
    const advisorData = advisorSnap.data();
    if (advisorData.advisorStatus !== "ACTIVE") {
        return {
            status: "INVALID",
            publicMessage: "No pudimos validar el contexto del consultor."
        };
    }
    return {
        status: "VALID",
        advisorDisplayName: advisorData.displayName || advisorData.name,
        publicMessage: `Estás conectado con ${advisorData.displayName || advisorData.name}`
    };
});
//# sourceMappingURL=resolveAdvisorByCode.js.map