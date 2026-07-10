import * as functions from "firebase-functions";
import { DiscoveryReportGenerationService } from "./DiscoveryReportGenerationService";
import { ReportType } from "./types";

export const generateDiscoveryReport = functions.https.onCall(async (request) => {
  // Validate request
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }
  
  const { sessionId, prospectId, isInternalOnly } = request.data;
  if (!sessionId || !prospectId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing sessionId or prospectId.");
  }

  const reportType: ReportType = isInternalOnly ? "INTERNAL_BRIEFING" : "EXTERNAL_RADIOGRAFIA";

  try {
    const result = await DiscoveryReportGenerationService.generateReport(sessionId, prospectId, reportType);
    return {
      success: result.success,
      reportId: result.reportId,
      message: result.message
    };
  } catch (error: any) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});

