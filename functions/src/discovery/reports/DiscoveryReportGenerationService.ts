import * as admin from "firebase-admin";
import { ReportPdfGenerator } from "./pdf/ReportPdfGenerator";
import { BrandingEngine } from "./BrandingEngine";
import { ReportViewModel, DiscoveryReportMetadata, ReportType, DeliveryLevel } from "./types";
import { LifecycleEventType } from "../../prospects/types";
import { buildDiscoveryReportViewModel } from "./DiscoveryReportViewModelBuilder";

export class DiscoveryReportGenerationService {
  /**
   * Generates a discovery report (PDF) and saves it to Firebase Storage.
   * Updates metadata and handles idempotency.
   */
  public static async generateReport(
    sessionId: string,
    prospectId: string,
    reportType: ReportType,
    forceRegenerate: boolean = false
  ): Promise<{ success: boolean; reportId: string; message: string; metadata?: DiscoveryReportMetadata }> {
    const db = admin.firestore();
    const storage = admin.storage();

    const sessionDoc = await db.collection("discovery_sessions").doc(sessionId).get();
    if (!sessionDoc.exists) {
      throw new Error("Discovery Session not found.");
    }
    const prospectDoc = await db.collection("platform_leads").doc(prospectId).get();
    if (!prospectDoc.exists) {
      throw new Error("Prospect not found.");
    }

    const sessionData = sessionDoc.data()!;
    const dossier = sessionData.dossier || {};

    const deliveryLevel = "ALLOW_FULL" as DeliveryLevel; // In real app from DiscoverySecurityLayer
    if (deliveryLevel === "BLOCK_ABUSE") {
      throw new Error("Generation blocked due to security policies.");
    }

    const branding = await BrandingEngine.getBrandingProfile();
    const folio = `AURA-DX-${new Date().getFullYear()}-${prospectId.substring(0, 6).toUpperCase()}`;
    const documentVersion = "1.0"; 
    const reportId = `${sessionId}_${reportType}_v${documentVersion}`;
    const metadataRef = db.collection("discovery_reports").doc(reportId);

    return await db.runTransaction(async (t) => {
      const existingMetadata = await t.get(metadataRef);

      if (existingMetadata.exists) {
        const data = existingMetadata.data() as DiscoveryReportMetadata;
        
        if (data.status === "REVOKED") {
          throw new Error("DOCUMENT_REVOKED");
        }

        if (data.status === "GENERATING" && !forceRegenerate) {
          return {
            success: true,
            reportId,
            message: "Report is currently GENERATING.",
            metadata: data
          };
        }

        if (data.status === "READY" && !forceRegenerate) {
          return {
            success: true,
            reportId,
            message: "Report already exists and is READY.",
            metadata: data
          };
        }
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
        createdAt: existingMetadata.exists ? existingMetadata.data()!.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      t.set(metadataRef, metadata);
      
      return {
        success: true,
        reportId,
        message: "Generation started.",
        metadata
      };
    }).then(async (result) => {
      if (result.metadata?.status === "GENERATING" && result.message === "Generation started.") {
        // Execute the heavy generation outside the transaction
        try {
          const metadata = result.metadata;
          let pdfBuffer: Buffer;

          const viewModel: ReportViewModel = buildDiscoveryReportViewModel({
            reportId,
            deliveryLevel,
            folio,
            generatedAt: metadata.generatedAt,
            sessionData,
          });

          if (reportType === "EXTERNAL_RADIOGRAFIA") {
            pdfBuffer = await ReportPdfGenerator.generateExternalRadiografia(viewModel, branding);
          } else {
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

          const bucket = storage.bucket();
          const file = bucket.file(metadata.storagePath);
          await file.save(pdfBuffer, {
            metadata: {
              contentType: 'application/pdf',
              metadata: { reportId, prospectId, sessionId }
            }
          });

          await metadataRef.update({
            status: "READY",
            readyAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          const eventRef = db.collection("platform_events").doc();
          await eventRef.set({
            eventId: eventRef.id,
            type: LifecycleEventType.DISCOVERY_REPORT_READY,
            prospectId,
            sessionId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            actorType: "SYSTEM",
            source: "DiscoveryReportGenerationService",
            metadata: { reportId, reportType, folio }
          });

          const finalMetadata = (await metadataRef.get()).data() as DiscoveryReportMetadata;
          return {
            success: true,
            reportId,
            message: "Report generated successfully.",
            metadata: finalMetadata
          };

        } catch (error: unknown) {
          console.error("[DiscoveryReportGenerationService] Error generating report", error);
          await metadataRef.update({
            status: "ERROR",
            updatedAt: new Date().toISOString()
          });
          const message = error instanceof Error ? error.message : "Unknown error";
          throw new Error(`Failed to generate PDF: ${message}`, { cause: error });
        }
      }
      return result;
    });
  }
}
