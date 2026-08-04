import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateOpaqueToken, generateTokenHash } from "./discoverySecurityService";
import { FirestoreDiscoveryCapabilityRepository } from
  "../infrastructure/firestore/discoveryCapabilities";
import { toDiscoveryCapabilityHttpsError } from "./discoveryCapabilityHandlerSupport";
import { parseCapabilityExchangeRequestV1 } from "./payloadBounds";
import { toDiscoveryPayloadHttpsError } from "./discoveryPayloadHandlerSupport";
import {
  deriveTelemetryDerivedSubjectV1,
  normalizeTelemetryReasonCodeV1,
  recordDiscoveryTelemetrySafe,
} from "./telemetry";
import { enforceDiscoveryContainmentV1 } from "./containment";

export const exchangeDiscoveryToken = functions.https.onCall(async (request) => {
  const startedAt = Date.now();
  const db = admin.firestore();
  if (request.app == undefined) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "APP_CHECK_REQUIRED"
    );
  }

  let payload;
  try {
    payload = parseCapabilityExchangeRequestV1(request.data);
  } catch (error: unknown) {
    await recordDiscoveryTelemetrySafe(db, {
      eventType: "payload.invalid", source: "exchangeDiscoveryToken",
      component: "discovery.capability", outcome: "REJECTED",
      reasonCode: normalizeTelemetryReasonCodeV1(error), durationMs: Date.now() - startedAt,
      correlationKey: `exchange:${startedAt}`, requestKey: `exchange:${startedAt}:invalid`,
      measurements: { requests: 1, rejections: 1 },
    });
    throw toDiscoveryPayloadHttpsError(error) ?? error;
  }
  const { linkId, oneTimeToken } = payload;

  await enforceDiscoveryContainmentV1(db, {
    surface: "TOKEN_ISSUANCE", source: "exchangeDiscoveryToken",
    component: "discovery.capability", correlationKey: linkId,
    requestKey: `${linkId}:exchange`, startedAt,
    ...(request.app?.appId ? { appId: request.app.appId } : {}),
  });

  const sessionAccessToken = generateOpaqueToken();
  const sessionTokenHash = generateTokenHash(sessionAccessToken);
  let linkData: admin.firestore.DocumentData;
  try {
    ({ linkData } = await new FirestoreDiscoveryCapabilityRepository(db)
      .exchangeLegacyLink({ linkId, exchangeToken: oneTimeToken, sessionTokenHash }));
  } catch (error: unknown) {
    await recordDiscoveryTelemetrySafe(db, {
      eventType: "capability.rejected", source: "exchangeDiscoveryToken",
      component: "discovery.capability", outcome: "REJECTED",
      reasonCode: normalizeTelemetryReasonCodeV1(error), durationMs: Date.now() - startedAt,
      correlationKey: linkId, requestKey: `${linkId}:exchange`,
      subject: deriveTelemetryDerivedSubjectV1(generateTokenHash(oneTimeToken)),
      measurements: { requests: 1, rejections: 1 },
    });
    throw toDiscoveryCapabilityHttpsError(error);
  }

  await recordDiscoveryTelemetrySafe(db, {
    eventType: "capability.accepted", source: "exchangeDiscoveryToken",
    component: "discovery.capability", outcome: "ACCEPTED",
    reasonCode: "EXCHANGE_ACCEPTED", durationMs: Date.now() - startedAt,
    correlationKey: linkId, requestKey: `${linkId}:exchange`,
    subject: deriveTelemetryDerivedSubjectV1(generateTokenHash(oneTimeToken)),
    measurements: { requests: 1 },
  });

  return {
    sessionAccessToken,
    linkId,
    trustScoreDecision: linkData.trustScore?.decision || "ALLOW_FULL",
    companyName: linkData.companyName,
    contactName: linkData.contactName
  };
});
