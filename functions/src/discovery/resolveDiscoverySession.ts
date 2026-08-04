import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FirestoreDiscoveryCapabilityRepository } from
  "../infrastructure/firestore/discoveryCapabilities";
import { toDiscoveryCapabilityHttpsError } from "./discoveryCapabilityHandlerSupport";
import { parseSessionResolutionRequestV1 } from "./payloadBounds";
import { toDiscoveryPayloadHttpsError } from "./discoveryPayloadHandlerSupport";
import { generateTokenHash } from "./discoverySecurityService";
import {
  deriveTelemetryDerivedSubjectV1,
  normalizeTelemetryReasonCodeV1,
  recordDiscoveryTelemetrySafe,
} from "./telemetry";

export const resolveDiscoverySession = functions.https.onCall(async (request) => {
  const startedAt = Date.now();
  const db = admin.firestore();
  if (request.app == undefined) {
    throw new functions.https.HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
  }

  let payload;
  try {
    payload = parseSessionResolutionRequestV1(request.data);
  } catch (error: unknown) {
    await recordDiscoveryTelemetrySafe(db, {
      eventType: "payload.invalid", source: "resolveDiscoverySession",
      component: "discovery.capability", outcome: "REJECTED",
      reasonCode: normalizeTelemetryReasonCodeV1(error), durationMs: Date.now() - startedAt,
      correlationKey: `resolve:${startedAt}`, requestKey: `resolve:${startedAt}:invalid`,
      measurements: { requests: 1, rejections: 1 },
    });
    throw toDiscoveryPayloadHttpsError(error) ?? error;
  }
  const { linkId, sessionToken } = payload;

  let linkData: admin.firestore.DocumentData;
  try {
    ({ linkData } = await new FirestoreDiscoveryCapabilityRepository(db)
      .authorizeSession({ token: sessionToken, linkId, allowCompleted: true }));
  } catch (error: unknown) {
    await recordDiscoveryTelemetrySafe(db, {
      eventType: "capability.rejected", source: "resolveDiscoverySession",
      component: "discovery.capability", outcome: "REJECTED",
      reasonCode: normalizeTelemetryReasonCodeV1(error), durationMs: Date.now() - startedAt,
      correlationKey: linkId, requestKey: `${linkId}:resolve`,
      subject: deriveTelemetryDerivedSubjectV1(generateTokenHash(sessionToken)),
      measurements: { requests: 1, rejections: 1 },
    });
    throw toDiscoveryCapabilityHttpsError(error);
  }

  await recordDiscoveryTelemetrySafe(db, {
    eventType: "capability.accepted", source: "resolveDiscoverySession",
    component: "discovery.capability", outcome: "ACCEPTED",
    reasonCode: "SESSION_RESOLVED", durationMs: Date.now() - startedAt,
    correlationKey: linkId, requestKey: `${linkId}:resolve`,
    subject: deriveTelemetryDerivedSubjectV1(generateTokenHash(sessionToken)),
    measurements: { requests: 1 },
  });

  // Return non-sensitive data
  return {
    id: linkId,
    companyName: linkData.companyName,
    contactName: linkData.contactName,
    status: linkData.status,
    trustScoreDecision: linkData.trustScore?.decision || "ALLOW_FULL"
  };
});
