import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { DiscoveryReportGenerationService } from "./DiscoveryReportGenerationService";
import { ReportType } from "./types";
import { resolvePlatformPrincipal } from "../../auth/resolvePlatformPrincipal";
import { authorizeDiscoveryReportSession } from "./requestExecutiveDocument";

async function authorizeAuthenticatedReportGeneration(
  db: admin.firestore.Firestore,
  auth: NonNullable<Parameters<typeof resolvePlatformPrincipal>[1]>,
  prospectId: string
): Promise<void> {
  const caller = await resolvePlatformPrincipal(db, auth);
  const allowedAdminRoles = [
    "FOUNDER",
    "SUPER_ADMIN",
    "SALES_DIRECTOR",
    "PLATFORM_OWNER",
    "PLATFORM_PARTNER",
    "PARTNER",
  ];
  if (allowedAdminRoles.includes(caller.role)) return;

  if (caller.role === "SALES_ADVISOR") {
    const prospectSnap = await db.collection("platform_leads").doc(prospectId).get();
    const advisorId = caller.advisorId || caller.id;
    if (prospectSnap.exists && prospectSnap.data()?.currentAdvisorId === advisorId) return;
  }

  throw new functions.https.HttpsError("permission-denied", "User is not authorized for this prospect.");
}

export const generateDiscoveryReport = functions.https.onCall(async (request) => {
  if (request.app == undefined) {
    throw new functions.https.HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
  }

  const { sessionId, prospectId, linkId, sessionToken, isInternalOnly } = request.data;

  // Validation checks
  const isString = typeof sessionId === "string";
  const isNotEmpty = isString && sessionId.trim().length > 0;
  const startsWithDossier = isString && sessionId.startsWith("dossier_");
  const containsSpaces = isString && (sessionId.includes(" ") || sessionId.includes("\n") || sessionId.includes("\r"));
  const isLiteralUndefined = sessionId === "undefined";

  if (!isString || !isNotEmpty || !startsWithDossier || containsSpaces || isLiteralUndefined) {
    throw new functions.https.HttpsError("invalid-argument", "INVALID_DISCOVERY_DOSSIER_ID");
  }

  if (
    typeof prospectId !== "string" ||
    prospectId.trim().length === 0 ||
    prospectId.length > 128 ||
    prospectId.includes("/")
  ) {
    throw new functions.https.HttpsError("invalid-argument", "Missing sessionId or prospectId.");
  }

  const reportType: ReportType = isInternalOnly ? "INTERNAL_BRIEFING" : "EXTERNAL_RADIOGRAFIA";
  const db = admin.firestore();

  if (sessionToken || linkId) {
    if (reportType !== "EXTERNAL_RADIOGRAFIA") {
      throw new functions.https.HttpsError("permission-denied", "Public sessions cannot generate internal reports.");
    }
    await authorizeDiscoveryReportSession(db, {
      linkId,
      sessionToken,
      targetSessionId: sessionId,
      targetProspectId: prospectId,
    });
  } else if (request.auth) {
    await authorizeAuthenticatedReportGeneration(db, request.auth, prospectId);
  } else {
    throw new functions.https.HttpsError("unauthenticated", "Authentication or session token required.");
  }

  try {
    const result = await DiscoveryReportGenerationService.generateReport(sessionId, prospectId, reportType);
    return {
      success: result.success,
      reportId: result.reportId,
      message: result.message
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "DISCOVERY_REPORT_GENERATION_FAILED";
    throw new functions.https.HttpsError("internal", message);
  }
});

