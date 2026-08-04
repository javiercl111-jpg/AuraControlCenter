import * as admin from "firebase-admin";
import { ReportPdfGenerator } from "./pdf/ReportPdfGenerator";
import { BrandingEngine } from "./BrandingEngine";
import { ReportViewModel, DiscoveryReportMetadata, ReportType, DeliveryLevel } from "./types";
import { LifecycleEventType } from "../../prospects/types";
import { buildDiscoveryReportViewModel } from "./DiscoveryReportViewModelBuilder";
import { hashDiscoveryCapabilityToken } from "../capabilities";
import {
  DISCOVERY_COST_BOUND_POLICY_V1,
  DiscoveryPayloadError,
  payloadBytes,
} from "../payloadBounds";
import {
  deriveTelemetryDerivedSubjectV1,
  normalizeTelemetryReasonCodeV1,
  recordDiscoveryTelemetrySafe,
} from "../telemetry";

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let handle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        handle = setTimeout(
          () => reject(new DiscoveryPayloadError("REPORT_BUDGET_EXCEEDED")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (handle !== undefined) clearTimeout(handle);
  }
}

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
    const startedAt = Date.now();
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
    const datasetBytes = payloadBytes(sessionData);
    if (datasetBytes > DISCOVERY_COST_BOUND_POLICY_V1.reportDatasetMaxBytes) {
      await recordDiscoveryTelemetrySafe(db, {
        eventType: "report.denied", source: "DiscoveryReportGenerationService",
        component: "discovery.report", outcome: "DENIED",
        reasonCode: "REPORT_DATASET_TOO_LARGE", durationMs: Date.now() - startedAt,
        correlationKey: sessionId, requestKey: `${sessionId}:${reportType}`,
        subject: deriveTelemetryDerivedSubjectV1(sessionId),
        measurements: { rejections: 1 },
      });
      throw new DiscoveryPayloadError("REPORT_BUDGET_EXCEEDED");
    }

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
        const generationAttemptCount = data.generationAttemptCount ?? 1;
        const forceRegenerationCount = data.forceRegenerationCount ?? 0;
        
        if (data.status === "REVOKED") {
          throw new Error("DOCUMENT_REVOKED");
        }

        if (data.status === "GENERATING") {
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
        if (
          generationAttemptCount >=
            DISCOVERY_COST_BOUND_POLICY_V1.reportMaxLogicalAttempts ||
          (forceRegenerate && forceRegenerationCount >=
            DISCOVERY_COST_BOUND_POLICY_V1.reportMaxForcedRegenerations)
        ) {
          throw new DiscoveryPayloadError("REPORT_BUDGET_EXCEEDED");
        }
      }

      const previous = existingMetadata.exists
        ? existingMetadata.data() as DiscoveryReportMetadata
        : undefined;

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
        generationAttemptCount: (previous?.generationAttemptCount ?? 0) + 1,
        forceRegenerationCount:
          (previous?.forceRegenerationCount ?? 0) + (forceRegenerate ? 1 : 0),
        datasetBytes,
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
            pdfBuffer = await withTimeout(
              ReportPdfGenerator.generateExternalRadiografia(viewModel, branding),
              DISCOVERY_COST_BOUND_POLICY_V1.reportGenerationTimeoutMs,
            );
          } else {
            const internalPdfBuffer = await withTimeout(ReportPdfGenerator.generateInternalBriefing(
              {
                ...viewModel,
                prospectId,
                opportunityScore: dossier.opportunityScore || 0,
                probabilityOfClosing: dossier.probabilityOfClosing || "N/A",
                nextBestAction: dossier.nextBestAction || "N/A",
                confidenceLevel: dossier.confidenceLevel || "N/A"
              },
              branding
            ), DISCOVERY_COST_BOUND_POLICY_V1.reportGenerationTimeoutMs);
            pdfBuffer = internalPdfBuffer;
          }

          if (pdfBuffer.byteLength > DISCOVERY_COST_BOUND_POLICY_V1.reportPdfMaxBytes) {
            throw new DiscoveryPayloadError("REPORT_BUDGET_EXCEEDED");
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
            pdfBytes: pdfBuffer.byteLength,
            readyAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          const eventId = `report_ready_${hashDiscoveryCapabilityToken(reportId).slice(0, 40)}`;
          const eventRef = db.collection("platform_events").doc(eventId);
          await eventRef.set({
            eventId,
            type: LifecycleEventType.DISCOVERY_REPORT_READY,
            prospectId,
            sessionId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            actorType: "SYSTEM",
            source: "DiscoveryReportGenerationService",
            metadata: { reportId, reportType, folio }
          }, { merge: true });

          const finalMetadata = (await metadataRef.get()).data() as DiscoveryReportMetadata;
          await recordDiscoveryTelemetrySafe(db, {
            eventType: "report.generated", source: "DiscoveryReportGenerationService",
            component: "discovery.report", outcome: "COMPLETED",
            reasonCode: "REPORT_GENERATED", durationMs: Date.now() - startedAt,
            correlationKey: sessionId, requestKey: reportId,
            subject: deriveTelemetryDerivedSubjectV1(reportId),
            measurements: { pdfs: 1, pdfBytes: pdfBuffer.byteLength },
          });
          return {
            success: true,
            reportId,
            message: "Report generated successfully.",
            metadata: finalMetadata
          };

        } catch (error: unknown) {
          console.error("[DiscoveryReportGenerationService] Error generating report", {
            reasonCode: normalizeTelemetryReasonCodeV1(error),
          });
          await metadataRef.update({
            status: "ERROR",
            updatedAt: new Date().toISOString()
          });
          await recordDiscoveryTelemetrySafe(db, {
            eventType: "report.denied", source: "DiscoveryReportGenerationService",
            component: "discovery.report", outcome: "DENIED",
            reasonCode: normalizeTelemetryReasonCodeV1(error),
            durationMs: Date.now() - startedAt, correlationKey: sessionId,
            requestKey: reportId, subject: deriveTelemetryDerivedSubjectV1(reportId),
            measurements: { rejections: 1 },
          });
          const message = error instanceof Error ? error.message : "Unknown error";
          if (error instanceof DiscoveryPayloadError) throw error;
          throw new Error(`Failed to generate PDF: ${message}`, { cause: error });
        }
      }
      return result;
    });
  }
}
