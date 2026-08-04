import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateOpaqueToken, generateTokenHash } from "./discoverySecurityService";
import { FirestoreDiscoveryCapabilityRepository } from
  "../infrastructure/firestore/discoveryCapabilities";
import { toDiscoveryCapabilityHttpsError } from "./discoveryCapabilityHandlerSupport";
import { parseCapabilityExchangeRequestV1 } from "./payloadBounds";
import { toDiscoveryPayloadHttpsError } from "./discoveryPayloadHandlerSupport";

export const exchangeDiscoveryToken = functions.https.onCall(async (request) => {
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
    throw toDiscoveryPayloadHttpsError(error) ?? error;
  }
  const { linkId, oneTimeToken } = payload;

  const db = admin.firestore();
  const sessionAccessToken = generateOpaqueToken();
  const sessionTokenHash = generateTokenHash(sessionAccessToken);
  let linkData: admin.firestore.DocumentData;
  try {
    ({ linkData } = await new FirestoreDiscoveryCapabilityRepository(db)
      .exchangeLegacyLink({ linkId, exchangeToken: oneTimeToken, sessionTokenHash }));
  } catch (error: unknown) {
    throw toDiscoveryCapabilityHttpsError(error);
  }

  return {
    sessionAccessToken,
    linkId,
    trustScoreDecision: linkData.trustScore?.decision || "ALLOW_FULL",
    companyName: linkData.companyName,
    contactName: linkData.contactName
  };
});
