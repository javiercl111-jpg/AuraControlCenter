import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateTokenHash } from "../discoverySecurityService";
import { DiscoveryReportGenerationService } from "./DiscoveryReportGenerationService";
import { DiscoveryReportMetadata, ReportType } from "./types";
import { LifecycleEventType } from "../../prospects/types";

export const requestExecutiveDocument = functions.https.onCall(async (request) => {
  if (request.app == undefined) {
    throw new functions.https.HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
  }

  const { reportId, sessionToken, forceRegenerate } = request.data;
  if (!reportId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing reportId.");
  }

  const db = admin.firestore();
  const metadataRef = db.collection("discovery_reports").doc(reportId);
  const metadataSnap = await metadataRef.get();

  let isProspect = false;
  let isAuthorized = false;
  let allowedReportTypes: ReportType[] = [];
  let userContext = "UNKNOWN";

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
  let targetSessionId = "";
  let targetProspectId = "";
  let targetReportType: ReportType = "EXTERNAL_RADIOGRAFIA";

  if (metadataSnap.exists) {
    const data = metadataSnap.data() as DiscoveryReportMetadata;
    targetSessionId = data.sessionId;
    targetProspectId = data.prospectId;
    targetReportType = data.reportType;
  } else {
    // Attempt to parse reportId
    // format: sessionId_reportType_vVersion
    // sessionId itself might have underscores (e.g. dossier_8QF2L_123456)
    const match = reportId.match(/^(.*)_(EXTERNAL_RADIOGRAFIA|INTERNAL_BRIEFING)_v([0-9\.]+)$/);
    if (!match) {
      throw new functions.https.HttpsError("not-found", "Document metadata not found and invalid ID format.");
    }
    targetSessionId = match[1];
    targetReportType = match[2] as ReportType;
    
    // We still need prospectId. We can get it from discovery_sessions -> prospectId
    const sessionSnap = await db.collection("discovery_sessions").doc(targetSessionId).get();
    if (!sessionSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Session not found.");
    }
    targetProspectId = sessionSnap.data()!.prospectId || "UNKNOWN";
  }

  // ---------------------------------------------------------
  // 1. Authorization Logic
  // ---------------------------------------------------------
  if (sessionToken) {
    // Prospect flow
    isProspect = true;
    const tokenHash = generateTokenHash(sessionToken);
    
    // Find link by sessionTokenHash
    const linksSnap = await db.collection("market_discovery_links").where("sessionTokenHash", "==", tokenHash).limit(1).get();
    if (linksSnap.empty) {
      throw new functions.https.HttpsError("permission-denied", "Invalid or expired session token.");
    }
    const linkData = linksSnap.docs[0].data();
    
    // Validate ownership
    if (linkData.dossierId !== targetSessionId) {
      throw new functions.https.HttpsError("permission-denied", "Report mismatch.");
    }

    isAuthorized = true;
    allowedReportTypes = ["EXTERNAL_RADIOGRAFIA"];
    userContext = `PROSPECT_${linksSnap.docs[0].id}`;

  } else if (request.auth) {
    // CRM flow
    const uid = request.auth.uid;
    const adminSnap = await db.collection("platform_global_admins").doc(uid).get();
    const isGlobalAdmin = adminSnap.exists && (adminSnap.data()?.role === "FOUNDER" || adminSnap.data()?.role === "SUPER_ADMIN" || adminSnap.data()?.role === "SALES_DIRECTOR");
    
    const advisorSnap = await db.collection("platform_sales_advisors").where("uid", "==", uid).limit(1).get();
    const isAdvisor = !advisorSnap.empty;

    if (isGlobalAdmin) {
      isAuthorized = true;
      allowedReportTypes = ["EXTERNAL_RADIOGRAFIA", "INTERNAL_BRIEFING"];
      userContext = `ADMIN_${uid}`;
    } else if (isAdvisor) {
      const advisorId = advisorSnap.docs[0].id;
      
      // Check if advisor owns the prospect
      const prospectSnap = await db.collection("platform_leads").doc(targetProspectId).get();
      if (prospectSnap.exists && prospectSnap.data()?.currentAdvisorId === advisorId) {
        isAuthorized = true;
        allowedReportTypes = ["EXTERNAL_RADIOGRAFIA", "INTERNAL_BRIEFING"];
        userContext = `ADVISOR_${advisorId}`;
      } else {
        throw new functions.https.HttpsError("permission-denied", "Advisor does not own this prospect.");
      }
    } else {
      throw new functions.https.HttpsError("permission-denied", "User is not authorized.");
    }
  } else {
    throw new functions.https.HttpsError("unauthenticated", "Authentication or session token required.");
  }

  if (!isAuthorized) {
    throw new functions.https.HttpsError("permission-denied", "Access denied.");
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
    } else {
      throw new functions.https.HttpsError("permission-denied", "Only administrators can force regenerate.");
    }
  }

  // ---------------------------------------------------------
  // 4. Generate or Verify Document
  // ---------------------------------------------------------
  try {
    const generationResult = await DiscoveryReportGenerationService.generateReport(
      targetSessionId,
      targetProspectId,
      targetReportType,
      shouldForceRegenerate
    );

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
        const regenResult = await DiscoveryReportGenerationService.generateReport(
          targetSessionId,
          targetProspectId,
          targetReportType,
          true // force
        );
        
        if (regenResult.metadata?.status === "READY") {
           // We'll proceed to generate URL below
        } else {
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
        if (ttlMinutes < 5) ttlMinutes = 5;
        if (ttlMinutes > 30) ttlMinutes = 30;
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
        type: LifecycleEventType.DISCOVERY_REPORT_DELIVERED,
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

  } catch (error: any) {
    if (error.message === "DOCUMENT_REVOKED") {
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
      metadata: { reportId, error: error.message }
    });
    
    throw new functions.https.HttpsError("internal", error.message);
  }

  return { status: "ERROR", retryAfterSeconds: 10 };
});
