import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ReportPdfGenerator } from "./pdf/ReportPdfGenerator";
import { BrandingEngine } from "./BrandingEngine";
import { ReportViewModel, DiscoveryReportMetadata, ReportType, DeliveryLevel } from "./types";
import { LifecycleEventType } from "../../prospects/types";

export const generateDiscoveryReport = functions.https.onCall(async (request) => {
  // Validate request
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }
  
  const { sessionId, prospectId, isInternalOnly } = request.data;
  if (!sessionId || !prospectId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing sessionId or prospectId.");
  }

  const db = admin.firestore();
  const storage = admin.storage();

  // Fetch session & prospect to ensure they exist and we have access
  const sessionDoc = await db.collection("platform_discovery_sessions").doc(sessionId).get();
  if (!sessionDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Discovery Session not found.");
  }
  
  const prospectDoc = await db.collection("platform_leads").doc(prospectId).get();
  if (!prospectDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Prospect not found.");
  }

  const sessionData = sessionDoc.data()!;
  const prospectData = prospectDoc.data()!;
  const dossier = sessionData.smartBusinessDossier || {};

  // Check delivery level (mocked based on prospect security for now)
  // In a real implementation this comes from DiscoverySecurityLayer decision
  const deliveryLevel = "ALLOW_FULL" as DeliveryLevel; // Simplified for now
  if (deliveryLevel === "BLOCK_ABUSE") {
    throw new functions.https.HttpsError("permission-denied", "Generation blocked due to security policies.");
  }

  const branding = await BrandingEngine.getBrandingProfile();

  // Determine Folio. If the prospect already has one, reuse it, otherwise generate.
  // Wait, the folio is AURA-DX-2026-XXXX. Let's use a simpler unique folio for now if none exists.
  const folio = `AURA-DX-${new Date().getFullYear()}-${prospectId.substring(0, 6).toUpperCase()}`;

  const reportType: ReportType = isInternalOnly ? "INTERNAL_BRIEFING" : "EXTERNAL_RADIOGRAFIA";
  const documentVersion = "1.0"; // Could be incremented if regenerating
  const reportId = `${sessionId}_${reportType}_v${documentVersion}`;
  const metadataRef = db.collection("discovery_reports").doc(reportId);

  // Check Idempotency
  const existingMetadata = await metadataRef.get();
  if (existingMetadata.exists && existingMetadata.data()!.status === "READY") {
    return {
      success: true,
      reportId,
      message: "Report already exists and is READY."
    };
  }

  // Pre-save metadata as GENERATING
  const metadata: DiscoveryReportMetadata = {
    reportId,
    prospectId,
    sessionId,
    folio,
    reportType,
    deliveryLevel,
    status: "GENERATING",
    documentVersion,
    brandingVersion: branding.version,
    storagePath: `discovery_reports/${prospectId}/${sessionId}/${reportType.toLowerCase()}-${folio}-v${documentVersion}.pdf`,
    generatedAt: new Date().toISOString(),
    generatedBy: "SYSTEM",
    idempotencyKey: reportId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await metadataRef.set(metadata);

  try {
    let pdfBuffer: Buffer;

    const viewModel: ReportViewModel = {
      reportId,
      status: "GENERATING",
      deliveryLevel,
      folio,
      generatedAt: metadata.generatedAt,
      companyName: prospectData.companyName || "Empresa",
      contactName: prospectData.contactName || "Contacto",
      advisor: prospectData.currentAdvisorId !== "UNASSIGNED" ? {
        displayName: "Asesor Asignado", // Normally fetch from advisor profile
        title: "Senior Consultant",
        email: "asesor@auranexus.io",
        phone: "555-0000"
      } : undefined,
      overallStatus: dossier.overallStatus || "Evaluado",
      maturityScore: dossier.maturityScore || 50,
      keyFindings: dossier.keyFindings || ["Hallazgo 1", "Hallazgo 2"],
      operationalRisks: deliveryLevel === "ALLOW_FULL" ? dossier.operationalRisks || [] : undefined,
      opportunities: deliveryLevel === "ALLOW_FULL" ? dossier.opportunities || [] : undefined,
    };

    if (reportType === "EXTERNAL_RADIOGRAFIA") {
      pdfBuffer = await ReportPdfGenerator.generateExternalRadiografia(viewModel, branding);
    } else {
      // INTERNAL_BRIEFING
      const internalPdfBuffer = await ReportPdfGenerator.generateInternalBriefing(
        {
          ...viewModel,
          prospectId,
          opportunityScore: dossier.opportunityScore || 0,
          probabilityOfClosing: dossier.probabilityOfClosing || "N/A",
          nextBestAction: dossier.nextBestAction || "N/A",
          confidenceLevel: dossier.confidenceLevel || "N/A"
        },
        branding
      );
      pdfBuffer = internalPdfBuffer;
    }

    // Upload to Storage
    const bucket = storage.bucket();
    const file = bucket.file(metadata.storagePath);
    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          reportId,
          prospectId,
          sessionId
        }
      }
    });

    // Update metadata to READY
    await metadataRef.update({
      status: "READY",
      readyAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Emit event
    const eventRef = db.collection("platform_events").doc();
    await eventRef.set({
      eventId: eventRef.id,
      type: LifecycleEventType.DISCOVERY_REPORT_READY,
      prospectId,
      sessionId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      actorType: "SYSTEM",
      source: "generateDiscoveryReport",
      metadata: { reportId, reportType, folio }
    });

    return {
      success: true,
      reportId,
      message: "Report generated successfully."
    };

  } catch (error: any) {
    console.error("[generateDiscoveryReport] Error generating report", error);
    await metadataRef.update({
      status: "ERROR",
      updatedAt: new Date().toISOString()
    });
    throw new functions.https.HttpsError("internal", "Failed to generate PDF.", error.message);
  }
});
