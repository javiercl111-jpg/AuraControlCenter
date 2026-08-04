import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { DiscoveryReportGenerationService } from "./DiscoveryReportGenerationService";
import { DiscoveryReportMetadata, ReportType } from "./types";
import { LifecycleEventType } from "../../prospects/types";
import { resolvePlatformPrincipal } from "../../auth/resolvePlatformPrincipal";
import {
  DISCOVERY_CAPABILITY_POLICY_V1,
  createDiscoveryReportIdV1,
  hashDiscoveryCapabilityToken,
} from "../capabilities";
import { FirestoreDiscoveryCapabilityRepository } from
  "../../infrastructure/firestore/discoveryCapabilities";
import { toDiscoveryCapabilityHttpsError } from
  "../discoveryCapabilityHandlerSupport";
import {
  FirestoreDiscoveryCostBudgetRepository,
  parseDocumentDownloadRequestV1,
} from "../payloadBounds";
import { toDiscoveryPayloadHttpsError } from
  "../discoveryPayloadHandlerSupport";
import {
  deriveTelemetryDerivedSubjectV1,
  normalizeTelemetryReasonCodeV1,
  recordDiscoveryTelemetrySafe,
} from "../telemetry";
import { enforceDiscoveryContainmentV1 } from "../containment";

export interface DiscoveryReportSessionScopeInput {
  storedSessionTokenHash?: string;
  presentedSessionTokenHash: string;
  sessionTokenExpiresAtMillis: number | null;
  linkStatus?: string;
  linkDossierId?: string;
  requestedSessionId: string;
  requestedProspectId: string;
  sessionLinkId?: string;
  requestedLinkId: string;
  sessionProspectId?: string;
  linkTenantId?: string;
  sessionTenantId?: string;
  prospectTenantId?: string;
  linkOrganizationId?: string;
  sessionOrganizationId?: string;
  prospectOrganizationId?: string;
}

export type DiscoveryReportSessionScopeFailure =
  | "SESSION_TOKEN_INVALID"
  | "SESSION_TOKEN_EXPIRED"
  | "DISCOVERY_SESSION_NOT_COMPLETED"
  | "DISCOVERY_SESSION_MISMATCH"
  | "DISCOVERY_PROSPECT_MISMATCH"
  | "DISCOVERY_TENANT_MISMATCH"
  | "DISCOVERY_ORGANIZATION_MISMATCH";

function distinctAuthorityValues(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  ))];
}

/** Compatibility-only predicate retained for the inherited D.9 regression suite. */
export function getDiscoveryReportSessionScopeFailure(
  input: DiscoveryReportSessionScopeInput,
  nowMillis: number = Date.now(),
): DiscoveryReportSessionScopeFailure | null {
  if (!input.storedSessionTokenHash || input.storedSessionTokenHash !== input.presentedSessionTokenHash) {
    return "SESSION_TOKEN_INVALID";
  }
  if (input.sessionTokenExpiresAtMillis === null || input.sessionTokenExpiresAtMillis <= nowMillis) {
    return "SESSION_TOKEN_EXPIRED";
  }
  if (input.linkStatus !== "completed") return "DISCOVERY_SESSION_NOT_COMPLETED";
  if (
    input.linkDossierId !== input.requestedSessionId ||
    input.sessionLinkId !== input.requestedLinkId
  ) return "DISCOVERY_SESSION_MISMATCH";
  if (input.sessionProspectId !== input.requestedProspectId) {
    return "DISCOVERY_PROSPECT_MISMATCH";
  }
  if (distinctAuthorityValues([
    input.linkTenantId, input.sessionTenantId, input.prospectTenantId,
  ]).length > 1) return "DISCOVERY_TENANT_MISMATCH";
  if (distinctAuthorityValues([
    input.linkOrganizationId, input.sessionOrganizationId,
    input.prospectOrganizationId,
  ]).length > 1) return "DISCOVERY_ORGANIZATION_MISMATCH";
  return null;
}

export interface AuthorizedDiscoveryReportScope {
  linkId: string;
  sessionId: string;
  prospectId: string;
  tenantId: string;
  organizationId: string;
}

/** Public report access accepts only a REPORT capability; SESSION is fail-closed. */
export async function authorizeDiscoveryReportSession(
  db: admin.firestore.Firestore,
  input: {
    linkId: unknown;
    sessionToken: unknown;
    targetSessionId: unknown;
    targetProspectId: unknown;
  },
): Promise<AuthorizedDiscoveryReportScope> {
  const { linkId, sessionToken, targetSessionId, targetProspectId } = input;
  if (
    typeof linkId !== "string" || linkId.length === 0 || linkId.length > 128 ||
    linkId.includes("/") || typeof sessionToken !== "string" ||
    !/^[a-f0-9]{64}$/i.test(sessionToken) ||
    typeof targetSessionId !== "string" || !targetSessionId.startsWith("dossier_") ||
    targetSessionId.length > 256 || targetSessionId.includes("/") ||
    typeof targetProspectId !== "string" || targetProspectId.length === 0 ||
    targetProspectId.length > 128 || targetProspectId.includes("/")
  ) {
    throw new functions.https.HttpsError("invalid-argument", "INVALID_DISCOVERY_REPORT_SCOPE");
  }
  try {
    const { capability, sessionData, linkData } =
      await new FirestoreDiscoveryCapabilityRepository(db).authorizeReport({
        token: sessionToken,
        reportId: createDiscoveryReportIdV1(targetSessionId),
        linkId,
      });
    if (
      capability.sessionId !== targetSessionId ||
      sessionData.linkId !== linkId ||
      sessionData.prospectId !== targetProspectId ||
      linkData.status !== "completed"
    ) {
      throw new functions.https.HttpsError(
        "permission-denied", "CAPABILITY_BINDING_MISMATCH",
      );
    }
    return {
      linkId,
      sessionId: targetSessionId,
      prospectId: targetProspectId,
      tenantId: distinctAuthorityValues([linkData.tenantId, sessionData.tenantId])[0] || "aura_root",
      organizationId: distinctAuthorityValues([
        linkData.organizationId, sessionData.organizationId,
      ])[0] || targetProspectId,
    };
  } catch (error: unknown) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw toDiscoveryCapabilityHttpsError(error);
  }
}

function parseReportId(reportId: string): { sessionId: string; reportType: ReportType } {
  const match = reportId.match(/^(.*)_(EXTERNAL_RADIOGRAFIA|INTERNAL_BRIEFING)_v([0-9.]+)$/);
  if (!match) {
    throw new functions.https.HttpsError("permission-denied", "REPORT_CAPABILITY_REQUIRED");
  }
  return { sessionId: match[1], reportType: match[2] as ReportType };
}

export const requestExecutiveDocument = functions.https.onCall(async (request) => {
  const startedAt = Date.now();
  const db = admin.firestore();
  if (request.app == undefined) {
    throw new functions.https.HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
  }
  let payload;
  try {
    payload = parseDocumentDownloadRequestV1(request.data);
  } catch (error: unknown) {
    await recordDiscoveryTelemetrySafe(db, {
      eventType: "payload.invalid", source: "requestExecutiveDocument",
      component: "discovery.download", outcome: "REJECTED",
      reasonCode: normalizeTelemetryReasonCodeV1(error), durationMs: Date.now() - startedAt,
      correlationKey: `download:${startedAt}`, requestKey: `download:${startedAt}:invalid`,
      measurements: { requests: 1, rejections: 1 },
    });
    throw toDiscoveryPayloadHttpsError(error) ?? error;
  }
  const { reportId, linkId, reportCapabilityToken, forceRegenerate } = payload;

  const publicToken = reportCapabilityToken;
  const publicRequest = publicToken !== "" || linkId !== "";
  let isProspect = false;
  let allowedReportTypes: ReportType[];
  let userContext: string;
  let targetSessionId: string;
  let targetProspectId: string;
  let targetReportType: ReportType;

  if (publicRequest) {
    if (!publicToken || !linkId) {
      throw new functions.https.HttpsError("permission-denied", "REPORT_CAPABILITY_REQUIRED");
    }
    const parsed = parseReportId(reportId);
    const capabilityScope = await new FirestoreDiscoveryCapabilityRepository(db)
      .authorizeReport({ token: publicToken, reportId, linkId })
      .catch(async (error: unknown) => {
        await recordDiscoveryTelemetrySafe(db, {
          eventType: "capability.rejected", source: "requestExecutiveDocument",
          component: "discovery.download", outcome: "REJECTED",
          reasonCode: normalizeTelemetryReasonCodeV1(error), durationMs: Date.now() - startedAt,
          correlationKey: reportId, requestKey: `${reportId}:authorize`,
          subject: deriveTelemetryDerivedSubjectV1(hashDiscoveryCapabilityToken(publicToken)),
        });
        await recordDiscoveryTelemetrySafe(db, {
          eventType: "download.denied", source: "requestExecutiveDocument",
          component: "discovery.download", outcome: "DENIED",
          reasonCode: normalizeTelemetryReasonCodeV1(error), durationMs: Date.now() - startedAt,
          correlationKey: reportId, requestKey: `${reportId}:denied`,
          subject: deriveTelemetryDerivedSubjectV1(reportId),
          measurements: { requests: 1, rejections: 1 },
        });
        throw toDiscoveryCapabilityHttpsError(error);
      });
    targetSessionId = capabilityScope.capability.sessionId!;
    targetProspectId = String(capabilityScope.sessionData.prospectId || "");
    targetReportType = parsed.reportType;
    if (
      parsed.sessionId !== targetSessionId || !targetProspectId ||
      capabilityScope.sessionData.linkId !== linkId ||
      capabilityScope.linkData.status !== "completed"
    ) {
      throw new functions.https.HttpsError("permission-denied", "CAPABILITY_BINDING_MISMATCH");
    }
    isProspect = true;
    allowedReportTypes = ["EXTERNAL_RADIOGRAFIA"];
    userContext = `PROSPECT_${linkId}`;
  } else if (request.auth) {
    const metadata = await db.collection("discovery_reports").doc(reportId).get();
    if (metadata.exists) {
      const data = metadata.data() as DiscoveryReportMetadata;
      targetSessionId = data.sessionId;
      targetProspectId = data.prospectId;
      targetReportType = data.reportType;
    } else {
      const parsed = parseReportId(reportId);
      targetSessionId = parsed.sessionId;
      targetReportType = parsed.reportType;
      const session = await db.collection("discovery_sessions").doc(targetSessionId).get();
      if (!session.exists || typeof session.data()?.prospectId !== "string") {
        throw new functions.https.HttpsError("not-found", "Document unavailable.");
      }
      targetProspectId = session.data()!.prospectId;
    }
    const caller = await resolvePlatformPrincipal(db, request.auth);
    const adminRoles = [
      "FOUNDER", "SUPER_ADMIN", "SALES_DIRECTOR", "PLATFORM_OWNER",
      "PLATFORM_PARTNER", "PARTNER",
    ];
    if (adminRoles.includes(caller.role)) {
      allowedReportTypes = ["EXTERNAL_RADIOGRAFIA", "INTERNAL_BRIEFING"];
      userContext = `ADMIN_${caller.id}`;
    } else if (caller.role === "SALES_ADVISOR") {
      const prospect = await db.collection("platform_leads").doc(targetProspectId).get();
      const advisorId = caller.advisorId || caller.id;
      if (!prospect.exists || prospect.data()?.currentAdvisorId !== advisorId) {
        throw new functions.https.HttpsError("permission-denied", "User is not authorized.");
      }
      allowedReportTypes = ["EXTERNAL_RADIOGRAFIA", "INTERNAL_BRIEFING"];
      userContext = `ADVISOR_${advisorId}`;
    } else {
      throw new functions.https.HttpsError("permission-denied", "User is not authorized.");
    }
  } else {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  if (!allowedReportTypes.includes(targetReportType)) {
    throw new functions.https.HttpsError("permission-denied", "REPORT_CAPABILITY_REQUIRED");
  }
  const shouldForceRegenerate = forceRegenerate === true && userContext.startsWith("ADMIN_");
  if (forceRegenerate === true && !shouldForceRegenerate) {
    throw new functions.https.HttpsError("permission-denied", "User is not authorized.");
  }

  await enforceDiscoveryContainmentV1(db, {
    surface: "DOCUMENT_DOWNLOAD", source: "requestExecutiveDocument",
    component: "discovery.download", correlationKey: targetSessionId || reportId,
    requestKey: `${reportId}:download`, startedAt,
    ...(request.app?.appId ? { appId: request.app.appId } : {}),
  });

  try {
    const reauthorizePublicReport = async (): Promise<void> => {
      if (!isProspect) return;
      await new FirestoreDiscoveryCapabilityRepository(db).authorizeReport({
        token: publicToken, reportId, linkId,
      });
    };
    await reauthorizePublicReport();
    const generation = await DiscoveryReportGenerationService.generateReport(
      targetSessionId, targetProspectId, targetReportType, shouldForceRegenerate,
    );
    const metadata = generation.metadata;
    if (!metadata) throw new Error("REPORT_METADATA_UNAVAILABLE");
    if (metadata.status === "REVOKED") {
      return { status: "REVOKED", safeErrorCode: "DOCUMENT_REVOKED" };
    }
    if (metadata.status === "GENERATING") {
      return { status: "GENERATING", retryAfterSeconds: 5 };
    }
    if (metadata.status === "ERROR") {
      return { status: "ERROR", retryAfterSeconds: 30 };
    }
    if (metadata.status !== "READY") {
      return { status: "ERROR", retryAfterSeconds: 10 };
    }

    await reauthorizePublicReport();
    const bucket = admin.storage().bucket();
    const file = bucket.file(metadata.storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      await reauthorizePublicReport();
      const regenerated = await DiscoveryReportGenerationService.generateReport(
        targetSessionId, targetProspectId, targetReportType, true,
      );
      if (regenerated.metadata?.status !== "READY") {
        return { status: "GENERATING", retryAfterSeconds: 5 };
      }
    }
    await reauthorizePublicReport();
    const downloadBudgetKey = isProspect
      ? `capability:${hashDiscoveryCapabilityToken(publicToken)}`
      : `platform:${reportId}:${userContext}`;
    try {
      await new FirestoreDiscoveryCostBudgetRepository(db)
        .consumeDownload(downloadBudgetKey);
    } catch (error: unknown) {
      throw toDiscoveryPayloadHttpsError(error) ?? error;
    }

    let ttlMinutes: number = DISCOVERY_CAPABILITY_POLICY_V1.documentSignedUrlTtlMinutes;
    if (!isProspect) {
      const settings = await db.collection("platform_settings").doc("discovery_security").get();
      ttlMinutes = Number(settings.data()?.executiveDocumentDownloadTtlMinutes || 10);
      ttlMinutes = Math.max(5, Math.min(30, ttlMinutes));
    }
    const expiresAt = Date.now() + ttlMinutes * 60 * 1_000;
    const [downloadUrl] = await file.getSignedUrl({
      action: "read", expires: expiresAt,
      promptSaveAs: `${targetReportType.toLowerCase()}.pdf`,
    });
    const actorKey = isProspect ? `public:${linkId}` : userContext;
    await recordDiscoveryTelemetrySafe(db, {
      eventType: "download.authorized", source: "requestExecutiveDocument",
      component: "discovery.download", outcome: "ALLOWED",
      reasonCode: "SIGNED_URL_AUTHORIZED", durationMs: Date.now() - startedAt,
      correlationKey: targetSessionId, requestKey: `${reportId}:${actorKey}`,
      subject: deriveTelemetryDerivedSubjectV1(reportId),
      measurements: { requests: 1, downloads: 1 },
    });
    const eventId = `report_delivered_${hashDiscoveryCapabilityToken(
      `${reportId}:${actorKey}`,
    ).slice(0, 40)}`;
    await db.collection("platform_events").doc(eventId).set({
      eventId,
      type: LifecycleEventType.DISCOVERY_REPORT_DELIVERED,
      prospectId: targetProspectId,
      sessionId: targetSessionId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      actorType: isProspect ? "PROSPECT" : "ADVISOR_ADMIN",
      source: "requestExecutiveDocument",
      metadata: {
        reportId: metadata.reportId,
        reportType: metadata.reportType,
        documentVersion: metadata.documentVersion,
        requestedByType: isProspect ? "PROSPECT" : "ADVISOR_ADMIN",
        deliveryMethod: "SIGNED_URL",
        expiresAt: new Date(expiresAt).toISOString(),
      },
    }, { merge: true });
    return {
      status: "READY",
      reportId: metadata.reportId,
      reportType: metadata.reportType,
      documentVersion: metadata.documentVersion,
      downloadUrl,
      expiresAt: new Date(expiresAt).toISOString(),
      generatedAt: metadata.generatedAt,
    };
  } catch (error: unknown) {
    await recordDiscoveryTelemetrySafe(db, {
      eventType: "download.denied", source: "requestExecutiveDocument",
      component: "discovery.download", outcome: "DENIED",
      reasonCode: normalizeTelemetryReasonCodeV1(error), durationMs: Date.now() - startedAt,
      correlationKey: targetSessionId || reportId, requestKey: `${reportId}:denied`,
      subject: deriveTelemetryDerivedSubjectV1(reportId),
      measurements: { requests: 1, rejections: 1 },
    });
    if (error instanceof functions.https.HttpsError) throw error;
    const payloadError = toDiscoveryPayloadHttpsError(error);
    if (payloadError !== null) throw payloadError;
    const capabilityError = toDiscoveryCapabilityHttpsError(error);
    if (capabilityError.message !== "COMPLETION_INTERNAL_FAILURE") throw capabilityError;
    const eventId = `report_failed_${hashDiscoveryCapabilityToken(reportId).slice(0, 40)}`;
    await db.collection("platform_events").doc(eventId).set({
      eventId,
      type: "DISCOVERY_REPORT_DOWNLOAD_FAILED",
      prospectId: targetProspectId,
      sessionId: targetSessionId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      actorType: isProspect ? "PROSPECT" : "ADVISOR_ADMIN",
      source: "requestExecutiveDocument",
      metadata: { reportId, reasonCode: normalizeTelemetryReasonCodeV1(error) },
    }, { merge: true });
    throw new functions.https.HttpsError("internal", "EXECUTIVE_DOCUMENT_REQUEST_FAILED");
  }
});
