import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";

import { ProspectResolutionEngine } from "../prospects/ProspectResolutionEngine";
import { AcquisitionSource, MergePayload, ProspectOrigin } from "../prospects/types";
import {
  EXECUTIVE_DISCOVERY_ADAPTER_VERSION,
} from "./executive-intelligence/adapter/DefaultExecutiveDiscoveryAdapter";
import type { ExecutiveDiscoveryAdapter } from
  "./executive-intelligence/contracts/ExecutiveDiscoveryAdapter";
import { EXECUTIVE_DISCOVERY_CAPABILITY_VERSION } from
  "./executive-intelligence/contracts/ExecutiveDiscoveryApiRequest";
import {
  ExecutiveDiscoveryTransportError,
  ExecutiveDiscoveryTransportErrorCode,
} from "./executive-intelligence/contracts/ExecutiveDiscoveryTransportError";
import {
  buildLegacyDiscoveryDiagnosis,
  executiveDiscoveryEndpointParam,
  resolveDiscoveryEvaluationFeatureFlags,
  runDiscoveryShadowEvaluation,
  type DiscoveryShadowPersistenceRecord,
} from "./executive-intelligence/integration";
import { validateDiscoveryCompletion } from "./discoveryCompletionValidation";
import {
  DISCOVERY_CAPABILITY_POLICY_V1,
  createDiscoveryCompletionPublicResultV1,
  createDiscoverySessionIdV1,
  deriveDiscoveryReportCapabilityTokenV1,
  hashDiscoveryCapabilityToken,
  hashDiscoveryCompletionRequestV1,
} from "./capabilities";
import { FirestoreDiscoveryCapabilityRepository } from
  "../infrastructure/firestore/discoveryCapabilities";
import {
  dispatchDiscoveryCompletionOutbox,
  toDiscoveryCapabilityHttpsError,
} from "./discoveryCapabilityHandlerSupport";
import { DiscoveryReportGenerationService } from
  "./reports/DiscoveryReportGenerationService";

const capabilitySecret = defineSecret("IDEMPOTENCY_SECRET");

const SHADOW_CONTROLLED_FIELDS = [
  "legacyDiagnosis", "shadowDiagnosis", "shadowMetadata", "shadowExecution",
  "shadowTimestamp", "shadowStatus", "shadowErrorCode", "shadowSafeErrorCode",
  "adapterVersion", "capabilityVersion",
] as const;

function withoutShadowControlledFields(
  payload: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const cleanPayload = { ...payload };
  delete cleanPayload.completedAt;
  for (const field of SHADOW_CONTROLLED_FIELDS) delete cleanPayload[field];
  return cleanPayload;
}

function createSecurityGatedShadowAdapter(): ExecutiveDiscoveryAdapter {
  throw new ExecutiveDiscoveryTransportError({
    code: ExecutiveDiscoveryTransportErrorCode.AUTHENTICATION_REQUIRED,
    message: "Executive Discovery service authentication is not configured.",
    retryable: false,
  });
}

function validateFirestorePayload(value: unknown, path = "payload"): void {
  if (value === undefined) throw new Error(`Invalid value: undefined at ${path}`);
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error(`Invalid number at ${path}`);
  }
  if (typeof value === "function") throw new Error(`Invalid function at ${path}`);
  if (!value || typeof value !== "object") return;
  if (value instanceof Date) throw new Error(`Invalid Date at ${path}`);
  const constructorName = (value as { constructor?: { name?: string } }).constructor?.name;
  if (constructorName && !["Object", "Array", "Timestamp", "FieldValue"].includes(constructorName)) {
    throw new Error(`Invalid class ${constructorName} at ${path}`);
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    validateFirestorePayload(child, `${path}.${key}`);
  }
}

export const completeDiscoverySession = functions.https.onCall(
  { secrets: [capabilitySecret] },
  async (request) => {
    if (request.app == undefined) {
      throw new functions.https.HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
    }
    const { linkId, sessionToken, dossierPayload } = request.data ?? {};
    if (
      typeof linkId !== "string" || linkId.length === 0 || linkId.length > 128 ||
      linkId.includes("/") || typeof sessionToken !== "string" ||
      !/^[a-f0-9]{64}$/i.test(sessionToken) ||
      !dossierPayload || typeof dossierPayload !== "object" ||
      Array.isArray(dossierPayload)
    ) {
      throw new functions.https.HttpsError("invalid-argument", "INVALID_COMPLETION_REQUEST");
    }
    for (const field of ["dossier", "conversationHistory", "conversationStateSnapshot"]) {
      if ((dossierPayload as Record<string, unknown>)[field] === undefined) {
        throw new functions.https.HttpsError("invalid-argument", "INVALID_COMPLETION_REQUEST");
      }
    }
    if (!Array.isArray((dossierPayload as Record<string, unknown>).conversationHistory)) {
      throw new functions.https.HttpsError("invalid-argument", "INVALID_COMPLETION_REQUEST");
    }

    const secret = capabilitySecret.value();
    if (!secret) {
      throw new functions.https.HttpsError("internal", "COMPLETION_INTERNAL_FAILURE");
    }
    const db = admin.firestore();
    const repository = new FirestoreDiscoveryCapabilityRepository(db);
    const sessionId = createDiscoverySessionIdV1(
      linkId, DISCOVERY_CAPABILITY_POLICY_V1.sessionGeneration,
    );
    const reportCapabilityToken = deriveDiscoveryReportCapabilityTokenV1(
      sessionId, DISCOVERY_CAPABILITY_POLICY_V1.reportGeneration, secret,
    );
    const requestHash = hashDiscoveryCompletionRequestV1({ linkId, dossierPayload });

    try {
      const result = await repository.completeWithEffect({
        sessionToken,
        linkId,
        requestHash,
        reportCapabilityHash: hashDiscoveryCapabilityToken(reportCapabilityToken),
        effect: async ({ transaction, linkData, dossierId }) => {
          const completion = validateDiscoveryCompletion({ dossierPayload, linkData });
          if (!completion.valid) {
            throw new functions.https.HttpsError(
              "failed-precondition", "DISCOVERY_REQUIRED_FIELDS_MISSING", completion,
            );
          }

          const trustDecision = linkData.trustScore?.decision || "ALLOW_FULL";
          const raw = dossierPayload as Record<string, any>;
          let finalExecutiveBriefing = raw.executiveBriefingDraft
            ? { ...raw.executiveBriefingDraft }
            : raw.executiveBriefingDraft;
          let finalRadiografia = raw.radiografiaEmpresarialDraft
            ? { ...raw.radiografiaEmpresarialDraft }
            : raw.radiografiaEmpresarialDraft;
          if (["ALLOW_BASIC", "REQUIRE_MANUAL_REVIEW", "BLOCK_ABUSE"].includes(trustDecision)) {
            if (finalExecutiveBriefing) {
              finalExecutiveBriefing.keyObservations = ["Reporte en validación."];
              finalExecutiveBriefing.suggestedNextSteps = [
                "Un especialista de Aura evaluará tus respuestas.",
              ];
            }
            if (finalRadiografia) {
              finalRadiografia.overallStatus = "En evaluación...";
              finalRadiografia.recommendedModules = [];
              finalRadiografia.potentialSavings = "Pendiente de validación comercial.";
            }
          }
          if (trustDecision === "BLOCK_ABUSE") {
            finalExecutiveBriefing = null;
            finalRadiografia = null;
          }

          const cleanPayload = withoutShadowControlledFields(raw);
          const validatedPayload: Record<string, unknown> = {
            id: dossierId,
            linkId,
            ...cleanPayload,
            companyName: linkData.companyName,
            contactName: linkData.contactName,
            recipientName: linkData.contactName,
            advisorId: linkData.advisorId || null,
            questionsAskedCount: completion.questionsAskedCount,
            completionReason: completion.completionReason,
            missingRequiredFields: completion.missingRequiredFields,
            evidenceGaps: completion.evidenceGaps,
            conversationMetrics: completion.conversationMetrics,
            conversationDefinitionVersion: completion.conversationDefinitionVersion,
            executiveBriefingDraft: finalExecutiveBriefing,
            radiografiaEmpresarialDraft: finalRadiografia,
          };

          const mergePayload: MergePayload = {
            companyName: linkData.companyName,
            contactName: linkData.contactName,
            email: linkData.email || "",
            phone: linkData.phone || "",
            advisorId: linkData.advisorId,
            advisorUid: linkData.advisorUid,
            linkId,
            sourceLeadId: linkData.prospectId,
            origin: linkData.advisorId && linkData.advisorId !== "UNKNOWN"
              ? ProspectOrigin.ADVISOR_SHARE
              : ProspectOrigin.WEBSITE,
            acquisitionSource: linkData.acquisitionSource || AcquisitionSource.DIRECT,
          };
          const resolution = await new ProspectResolutionEngine()
            .resolveProspect(mergePayload, transaction);
          const prospectId = resolution.matchedProspectId || null;
          validatedPayload.prospectId = prospectId;
          validateFirestorePayload(validatedPayload);
          const dossierData = {
            ...validatedPayload,
            legacyDiagnosis: buildLegacyDiscoveryDiagnosis(validatedPayload),
            createdAt: validatedPayload.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          return {
            dossierData,
            prospectId,
            resolutionStatus: resolution.resolutionReason || null,
            trustDecision,
            companyName: String(linkData.companyName || "Unknown"),
            prospectName: String(linkData.contactName || "Unknown"),
            advisorUid: typeof linkData.advisorUid === "string" ? linkData.advisorUid : null,
            advisorId: typeof linkData.advisorId === "string" ? linkData.advisorId : null,
            shadowEvaluationContext: {
              sessionId: dossierId,
              linkId,
              tenantId: linkData.tenantId,
              organizationId: linkData.organizationId,
              companyId: prospectId || linkData.companyId,
              locale: linkData.locale,
              trustDecision,
              capturedAt: new Date().toISOString(),
              session: validatedPayload,
              consents: linkData.consents,
              legacyDiagnosis: dossierData.legacyDiagnosis,
            },
          };
        },
      });

      await dispatchDiscoveryCompletionOutbox(db, result.completion);
      if (result.completion.prospectId) {
        try {
          await DiscoveryReportGenerationService.generateReport(
            result.completion.sessionId,
            result.completion.prospectId,
            "EXTERNAL_RADIOGRAFIA",
          );
        } catch (error: unknown) {
          console.error("DISCOVERY_REPORT_GENERATION_DEFERRED", {
            completionId: result.completion.completionId,
            error: error instanceof Error ? error.message : "UNKNOWN",
          });
        }
      }

      if (result.kind === "NEW" && result.shadowEvaluationContext) {
        const correlationId = `shadow_${result.completion.completionId}`;
        const startedAt = Date.now();
        const flags = resolveDiscoveryEvaluationFeatureFlags();
        const endpointConfigured = executiveDiscoveryEndpointParam.value().trim().length > 0;
        try {
          await runDiscoveryShadowEvaluation({
            context: result.shadowEvaluationContext as any,
            correlationId,
            flags,
            endpointConfigured,
            authenticationMode: "UNCONFIGURED",
            adapterFactory: createSecurityGatedShadowAdapter,
            persistence: {
              persist: async (record: DiscoveryShadowPersistenceRecord) => {
                await db.collection("discovery_sessions")
                  .doc(result.completion.dossierId).update({ ...record });
              },
            },
            logger: { log: (entry) => console.log({ stage: "DISCOVERY_SHADOW_EVALUATION", ...entry }) },
          });
        } catch {
          console.error({
            stage: "DISCOVERY_SHADOW_EVALUATION",
            correlationId,
            durationMs: Math.max(0, Date.now() - startedAt),
            status: "FAILED",
            capabilityVersion: EXECUTIVE_DISCOVERY_CAPABILITY_VERSION,
            adapterVersion: EXECUTIVE_DISCOVERY_ADAPTER_VERSION,
            safeErrorCode: "SHADOW_INTEGRATION_FAILED",
            endpointConfigured,
          });
        }
      }

      return createDiscoveryCompletionPublicResultV1(
        result.completion, reportCapabilityToken,
      );
    } catch (error: unknown) {
      if (error instanceof functions.https.HttpsError) throw error;
      throw toDiscoveryCapabilityHttpsError(error);
    }
  },
);
