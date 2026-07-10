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