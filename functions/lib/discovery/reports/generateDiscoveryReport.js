"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDiscoveryReport = void 0;
const functions = require("firebase-functions");
const DiscoveryReportGenerationService_1 = require("./DiscoveryReportGenerationService");
exports.generateDiscoveryReport = functions.https.onCall(async (request) => {
    // Validate request
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
    }
    const { sessionId, prospectId, isInternalOnly } = request.data;
    // Validation checks
    const isString = typeof sessionId === "string";
    const isNotEmpty = isString && sessionId.trim().length > 0;
    const startsWithDossier = isString && sessionId.startsWith("dossier_");
    const containsSpaces = isString && (sessionId.includes(" ") || sessionId.includes("\n") || sessionId.includes("\r"));
    const isLiteralUndefined = sessionId === "undefined";
    if (!isString || !isNotEmpty || !startsWithDossier || containsSpaces || isLiteralUndefined) {
        throw new functions.https.HttpsError("invalid-argument", "INVALID_DISCOVERY_DOSSIER_ID");
    }
    console.info("[DISCOVERY_TRACE_REPORT]", {
        receivedSessionId: sessionId,
        expectedPrefix: startsWithDossier,
        documentPath: `discovery_sessions/${sessionId}`
    });
    if (!sessionId || !prospectId) {
        throw new functions.https.HttpsError("invalid-argument", "Missing sessionId or prospectId.");
    }
    const reportType = isInternalOnly ? "INTERNAL_BRIEFING" : "EXTERNAL_RADIOGRAFIA";
    try {
        const result = await DiscoveryReportGenerationService_1.DiscoveryReportGenerationService.generateReport(sessionId, prospectId, reportType);
        return {
            success: result.success,
            reportId: result.reportId,
            message: result.message
        };
    }
    catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});
//# sourceMappingURL=generateDiscoveryReport.js.map