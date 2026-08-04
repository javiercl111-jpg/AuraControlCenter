import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FirestoreDiscoveryCapabilityRepository } from
  "../infrastructure/firestore/discoveryCapabilities";
import { toDiscoveryCapabilityHttpsError } from "./discoveryCapabilityHandlerSupport";
import { parseSessionResolutionRequestV1 } from "./payloadBounds";
import { toDiscoveryPayloadHttpsError } from "./discoveryPayloadHandlerSupport";

export const resolveDiscoverySession = functions.https.onCall(async (request) => {
  if (request.app == undefined) {
    throw new functions.https.HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
  }

  let payload;
  try {
    payload = parseSessionResolutionRequestV1(request.data);
  } catch (error: unknown) {
    throw toDiscoveryPayloadHttpsError(error) ?? error;
  }
  const { linkId, sessionToken } = payload;

  const db = admin.firestore();
  let linkData: admin.firestore.DocumentData;
  try {
    ({ linkData } = await new FirestoreDiscoveryCapabilityRepository(db)
      .authorizeSession({ token: sessionToken, linkId, allowCompleted: true }));
  } catch (error: unknown) {
    throw toDiscoveryCapabilityHttpsError(error);
  }

  // Return non-sensitive data
  return {
    id: linkId,
    companyName: linkData.companyName,
    contactName: linkData.contactName,
    status: linkData.status,
    trustScoreDecision: linkData.trustScore?.decision || "ALLOW_FULL"
  };
});
